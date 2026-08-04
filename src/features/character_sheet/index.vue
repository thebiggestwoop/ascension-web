<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { Character, computeStatModifiers } from '@/classes/Character'
import { AttributeId, SkillId, TalentCategory } from '@/classes/enums'
import type { IQualityInstance, IWeaponData } from '@/classes/Equipment'
import { EquipmentQuality, WeaponTag, MAX_INVENTORY_SLOTS, equipmentSlotCost } from '@/classes/Equipment'
import { mountedSpeed } from '@/classes/Mount'
import { exportCharacterToFile } from '@/io/CharacterTransfer'
import MarkdownText from '@/ui/MarkdownText.vue'
import { useCharacterSheetStore } from './store/CharacterSheetStore'
import LevelUpDialog from './components/LevelUpDialog.vue'
import LoadoutEditorDialog from './components/LoadoutEditorDialog.vue'
import SpellEditorDialog from './components/SpellEditorDialog.vue'
import EditLifepathDialog from './components/EditLifepathDialog.vue'
import SpellsSection from './components/SpellsSection.vue'
import NotesEditor from './components/NotesEditor.vue'
import TooltipChip from '@/ui/TooltipChip.vue'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'
import SegmentedBar from '@/ui/SegmentedBar.vue'

const HP_BAR_COLOR = '#750303'
const WILLPOWER_BAR_COLOR = '#877221'

function qualityLabel(q: IQualityInstance): string {
  const label = q.quality
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
  return q.value !== undefined ? `${label} ${q.value}` : label
}

function qualityTooltip(q: IQualityInstance): string | undefined {
  return CoreContent.equipment.qualities.find((x) => x.id === q.quality)?.description
}

function damageEffectLabel(effect: string): string {
  return CoreContent.equipment.damageEffects.find((e) => e.id === effect)?.name ?? effect
}

function damageEffectTooltip(effect: string): string | undefined {
  return CoreContent.equipment.damageEffects.find((e) => e.id === effect)?.description
}

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}

/** Attribute(s) used for the attacker's Skill Test with each Weapon Tag, per Chapter Seven. */
const WEAPON_TAG_ATTRIBUTES: Partial<Record<WeaponTag, AttributeId[]>> = {
  [WeaponTag.Sword]: [AttributeId.Agility],
  [WeaponTag.Axe]: [AttributeId.Brawn],
  [WeaponTag.Spear]: [AttributeId.Coordination],
  [WeaponTag.Bow]: [AttributeId.Awareness],
  [WeaponTag.Gauntlet]: [AttributeId.Agility, AttributeId.Brawn, AttributeId.Coordination],
}

/**
 * The Attribute the defender rolls against each Weapon Tag - a three-way cycle for the
 * melee tags (Sword > Coordination > Brawn (Spear) is defended by Brawn; Axe/Brawn is
 * defended by Agility; Sword/Agility is defended by Coordination), Bow defended by the same
 * Awareness it attacks with, and Gauntlet defended by whichever of Agility/Brawn/Coordination
 * the attacker chose to attack with (design team confirmed, not stated in the source doc -
 * its Weapon Triangle diagram is missing from this export).
 */
const WEAPON_TAG_DEFEND_ATTRIBUTES: Partial<Record<WeaponTag, AttributeId[]>> = {
  [WeaponTag.Sword]: [AttributeId.Coordination],
  [WeaponTag.Axe]: [AttributeId.Agility],
  [WeaponTag.Spear]: [AttributeId.Brawn],
  [WeaponTag.Bow]: [AttributeId.Awareness],
}

const props = defineProps<{ id: string }>()
const store = useCharacterSheetStore()
const showLevelUp = ref(false)
const showLoadoutEditor = ref(false)
const showSpellEditor = ref(false)
const showEditLifepath = ref(false)
const showRevertConfirm = ref(false)
const canLevelUp = computed(() => (store.character?.level ?? 0) < CoreContent.advancement.maxLevel)
const canRevertLevelUp = computed(() => (store.character?.levelUpHistory?.length ?? 0) > 0)

type StatKey = 'hp' | 'willpower'

/** Which of currentHp/currentWillpower is being click-to-edited inline, if any. */
const editingStat = ref<StatKey | null>(null)
const editValue = ref<number>(0)

function currentValueOf(stat: StatKey): number {
  if (!store.character) return 0
  return stat === 'hp' ? store.character.currentHp : store.character.currentWillpower
}
function maxValueOf(stat: StatKey): number {
  if (!character.value) return 0
  return stat === 'hp' ? character.value.maxHp : character.value.maxWillpower
}
/** The current HP value immediately before the last change made to it (from any source - a
 * pip click, Take Damage/Recover, or the inline exact-value edit) - lets the Undo button
 * step back exactly one change. Clicking Undo swaps this to the value it just replaced, so a
 * second click redoes the undo instead of doing nothing. Resets (only) when a different
 * character loads, so it never undoes across characters. */
const previousHp = ref<number | null>(null)

function applyDelta(stat: StatKey, delta: number) {
  if (stat === 'hp') {
    if (!store.character || delta === 0) return
    previousHp.value = store.character.currentHp
    store.adjustHp(delta, maxValueOf('hp'))
  } else {
    store.adjustWillpower(delta, maxValueOf('willpower'))
  }
}

/** A Health Bar pip's own click handler - sets current HP directly to that pip's absolute
 * value rather than the +/- buttons' relative delta, but goes through the same applyDelta()
 * so it's still tracked for Undo. Never touches Temporary HP. */
function pickHp(value: number) {
  if (!store.character) return
  applyDelta('hp', value - store.character.currentHp)
}

function undoHp() {
  if (previousHp.value === null || !store.character) return
  const current = store.character.currentHp
  store.adjustHp(previousHp.value - current, maxValueOf('hp'))
  previousHp.value = current
}

function startEdit(stat: StatKey) {
  editingStat.value = stat
  editValue.value = currentValueOf(stat)
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>('.current-value-input input')
    el?.focus()
    el?.select()
  })
}
function commitEdit() {
  if (!editingStat.value) return
  applyDelta(editingStat.value, editValue.value - currentValueOf(editingStat.value))
  editingStat.value = null
}

/**
 * Temp HP/Temp Resistance are always-visible number fields (not click-to-edit like current
 * HP/Willpower), so they can't just bind :model-value straight to the store: typing a second
 * digit (e.g. "1" then "0" for "10") emits an intermediate value that gets clamped and written
 * back immediately, and the store's echoed-back prop then overwrites the input mid-keystroke -
 * visually "snapping" the field back before the second digit lands. Editing a plain string
 * draft instead (no live coercion) and only clamping/committing on blur avoids that; a watch
 * keeps the draft in sync with external changes (e.g. Take Damage's Temp HP absorption) except
 * while the field is actively focused, so it doesn't fight the player's typing.
 */
const tempHpDraft = ref('0')
const tempHpFocused = ref(false)
const tempResistanceDraft = ref('0')
const tempResistanceFocused = ref(false)

watch(
  () => store.character?.temporaryHp,
  (v) => {
    if (v !== undefined && !tempHpFocused.value) tempHpDraft.value = String(v)
  },
  { immediate: true },
)
watch(
  () => store.character?.temporaryResistance,
  (v) => {
    if (v !== undefined && !tempResistanceFocused.value) tempResistanceDraft.value = String(v)
  },
  { immediate: true },
)

function commitTempHp() {
  tempHpFocused.value = false
  const parsed = Math.round(Number(tempHpDraft.value))
  store.setTemporaryHp(Number.isFinite(parsed) ? parsed : 0)
}
function commitTempResistance() {
  tempResistanceFocused.value = false
  const parsed = Math.round(Number(tempResistanceDraft.value))
  store.setTemporaryResistance(Number.isFinite(parsed) ? parsed : 0)
}
function blurActiveElement(event: Event) {
  ;(event.target as HTMLInputElement | null)?.blur()
}

/** "Take Damage"/"Recover" pop up this shared dialog with a pre-selected amount field instead
 * of making the player click a +/- button once per point. Taking Damage to HP additionally
 * offers "Apply Resistance" (reduce the incoming amount by Total Resistance first) and "Temp
 * HP first" (drain Temporary HP before real HP) - both on by default, since that's the normal
 * way damage works; either can be unchecked for damage that bypasses one or the other. */
const adjustDialog = ref<{
  show: boolean
  stat: StatKey
  mode: 'damage' | 'recover'
  amount: number
  applyResistance: boolean
  tempHpFirst: boolean
}>({
  show: false,
  stat: 'hp',
  mode: 'damage',
  amount: 1,
  applyResistance: true,
  tempHpFirst: true,
})

function openAdjustDialog(stat: StatKey, mode: 'damage' | 'recover') {
  adjustDialog.value = { show: true, stat, mode, amount: 1, applyResistance: true, tempHpFirst: true }
}
function focusAdjustInput() {
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>('.adjust-dialog-input input')
    el?.focus()
    el?.select()
  })
}
function confirmAdjustDialog() {
  const { stat, mode, amount } = adjustDialog.value

  if (stat === 'hp' && mode === 'damage' && store.character && character.value) {
    let remaining = Math.abs(amount)
    if (adjustDialog.value.applyResistance) {
      remaining = Math.max(0, remaining - character.value.totalResistance)
    }
    if (adjustDialog.value.tempHpFirst && store.character.temporaryHp > 0) {
      const absorbed = Math.min(store.character.temporaryHp, remaining)
      store.setTemporaryHp(store.character.temporaryHp - absorbed)
      remaining -= absorbed
    }
    if (remaining > 0) applyDelta('hp', -remaining)
    adjustDialog.value.show = false
    return
  }

  const delta = mode === 'damage' ? -Math.abs(amount) : Math.abs(amount)
  applyDelta(stat, delta)
  adjustDialog.value.show = false
}

async function confirmRevertLevelUp() {
  await store.revertLastLevelUp()
  showRevertConfirm.value = false
}

onMounted(() => store.loadById(props.id))
watch(() => props.id, (id) => {
  previousHp.value = null
  store.loadById(id)
})

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]

/**
 * Deliberately NOT Character.Deserialize()/toRaw(): those strip Vue's reactive Proxy via
 * structuredClone, so this computed would only re-run when `store.character` is reassigned
 * wholesale (e.g. on load) - not when actions mutate its fields in place (e.g. levelUp()
 * pushing a Talent or incrementing an Attribute). Constructing directly over the live proxy
 * keeps every nested read (attributes, talentIds, ...) tracked as a real dependency.
 */
const modifiers = computed(() => {
  if (!store.character) return {}
  return computeStatModifiers(store.character, allTalents, CoreContent.equipment.armor, CoreContent.equipment.general)
})
const character = computed(() => {
  if (!store.character) return null
  return new Character(store.character, modifiers.value)
})

const heldTalents = computed(() => {
  if (!store.character) return []
  const ids = store.character.talentIds
  return allTalents.filter((t) => ids.includes(t.id))
})

const talentCategoryFilter = ref<TalentCategory>(TalentCategory.Narrative)
const focusesMode = ref<'view' | 'edit'>('view')
const filteredHeldTalents = computed(() => heldTalents.value.filter((t) => t.category === talentCategoryFilter.value))

/**
 * Focuses/Values/Common Cause text fields can't just bind `:model-value` straight to the
 * store the way the rest of this file does read-only stats: every keystroke writes through
 * to the store immediately, and the store's echoed-back prop re-rendering the field mid-edit
 * risks the same "snap back before the next keystroke lands" issue documented above for Temp
 * HP/Temp Resistance. Editing a local draft instead (synced from the store only while the
 * field isn't focused) avoids that entirely.
 */
const focusDrafts = ref<string[]>([])
const editingFocusIndex = ref<number | null>(null)
watch(
  () => store.character?.focuses,
  (focuses) => {
    if (focuses && editingFocusIndex.value === null) focusDrafts.value = [...focuses]
  },
  { immediate: true, deep: true },
)
function commitFocusText(i: number, text: string) {
  focusDrafts.value[i] = text
  store.updateFocusText(i, text)
}

const valueDrafts = ref<string[]>([])
const editingValueIndex = ref<number | null>(null)
watch(
  () => store.character?.values,
  (values) => {
    if (values && editingValueIndex.value === null) valueDrafts.value = values.map((v) => v.text)
  },
  { immediate: true, deep: true },
)
function commitValueText(i: number, text: string) {
  valueDrafts.value[i] = text
  store.updateValueText(i, text)
}

const commonCauseDraft = ref('')
const editingCommonCause = ref(false)
watch(
  () => store.character?.commonCause?.text,
  (text) => {
    if (text !== undefined && !editingCommonCause.value) commonCauseDraft.value = text
  },
  { immediate: true },
)
function commitCommonCauseText(text: string) {
  commonCauseDraft.value = text
  store.updateCommonCauseText(text)
}

/** Weapons equipped, grouped by id with a count (dual-wielding two of the same weapon is common). */
const equippedWeaponGroups = computed(() => {
  if (!store.character) return []
  const counts: Record<string, number> = {}
  for (const id of store.character.equippedWeaponIds) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ weapon: CoreContent.equipment.weapons.find((w) => w.id === id), count }))
    .filter((g): g is { weapon: IWeaponData; count: number } => !!g.weapon)
})

const equippedArmor = computed(() =>
  store.character?.equippedArmorId
    ? CoreContent.equipment.armor.find((a) => a.id === store.character!.equippedArmorId)
    : undefined,
)

const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
const generalItemDescriptions = new Map(CoreContent.equipment.general.map((g) => [g.id, g.description]))
const inventoryGroups = computed(() => {
  if (!store.character) return []
  const counts: Record<string, number> = {}
  for (const id of store.character.inventoryItemIds) counts[id] = (counts[id] ?? 0) + 1
  return Object.entries(counts)
    .map(([id, count]) => ({ item: allInventoryItems.find((i) => i.id === id), count }))
    .filter((g): g is { item: (typeof allInventoryItems)[number]; count: number } => !!g.item)
})

const mount = computed(() =>
  store.character?.mountId ? CoreContent.equipment.mounts.find((m) => m.id === store.character!.mountId) : undefined,
)

/** Weapons + Armor + Inventory items all draw from the same 5-slot cap (Bulky = 2) - Mounts
 * aren't carried, so they don't count. */
const usedInventorySlots = computed(() => {
  let slots = 0
  for (const g of equippedWeaponGroups.value) slots += g.count * equipmentSlotCost(g.weapon.qualities)
  if (equippedArmor.value) slots += equipmentSlotCost(equippedArmor.value.qualities)
  for (const g of inventoryGroups.value) slots += g.count * equipmentSlotCost(g.item.qualities)
  return slots
})

const isSpellcaster = computed(() => store.character?.traits.some((t) => t.name === 'Spellcaster') ?? false)

const allSpells = [...CoreContent.spells.arcane, ...CoreContent.spells.light, ...CoreContent.spells.dark]
const usedSpellSlots = computed(() => {
  if (!store.character) return 0
  let slots = 0
  for (const id of store.character.preparedSpellIds) {
    const spell = allSpells.find((s) => s.id === id)
    if (spell) slots += spell.slotCost
  }
  return slots
})

/** "Agility / 17" style Task display: attribute(s) + that attribute's value plus Skirmish. */
function weaponTask(weapon: IWeaponData): string {
  if (!character.value) return '-'
  const attrs = WEAPON_TAG_ATTRIBUTES[weapon.tag]
  if (!attrs) return '-'
  return attrs
    .map((id) => `${attributeName(id)} ${character.value!.attribute(id) + character.value!.skill(SkillId.Skirmish)}`)
    .join(' / ')
}

/** "Coordination" for most tags; Gauntlet is defended with whichever attribute it attacked with. */
function weaponDefendedBy(weapon: IWeaponData): string {
  if (weapon.tag === WeaponTag.Gauntlet) return 'Same as Task'
  const attrs = WEAPON_TAG_DEFEND_ATTRIBUTES[weapon.tag]
  return attrs ? attrs.map(attributeName).join(' / ') : '-'
}

function weaponRangeOrReach(weapon: IWeaponData): { label: string; value: number | string } {
  if (weapon.range) return { label: 'Range', value: weapon.range }
  const extended = weapon.qualities.find((q) => q.quality === EquipmentQuality.Extended)
  return { label: 'Reach', value: extended?.value ?? 1 }
}

/** Base [CD] + the wielder's Damage Bonus (Skirmish) - "weapons gain additional [CD] to
 * their damage rating equal to the Skirmish Skill of the character," per Chapter Seven. */
function weaponDamageDisplay(weapon: IWeaponData): string {
  const bonus = character.value?.damageBonus ?? 0
  return `${weapon.damageCD + bonus}[CD]`
}

function weaponDamageTooltip(weapon: IWeaponData): string {
  const bonus = character.value?.damageBonus ?? 0
  return `Base ${weapon.damageCD}[CD], Skirmish +${bonus}`
}

/** "Effect Save = floor(Attribute / 2) - 1, one per Attribute" - shown nestled next to each
 * Attribute's own value since it's directly derived from it. */
function effectSaveTooltip(id: AttributeId): string {
  if (!character.value) return ''
  return `floor(${attributeName(id)} ${character.value.attribute(id)} / 2) - 1`
}

const resistanceTooltip = computed(() =>
  equippedArmor.value ? `${equippedArmor.value.name}'s Resistance` : 'No Armor equipped',
)
const totalResistanceTooltip = computed(() => {
  if (!character.value) return ''
  return `Resistance ${character.value.resistance} + Temporary Resistance ${character.value.temporaryResistance}`
})

/** "Wound 1... causing their speed to be reduced by 2" - Wound 2 doesn't stack a second
 * reduction, it just keeps Wound 1's penalty in effect, so any Wound at all means -2 Speed. */
const speedWoundPenalty = computed(() => (character.value?.wounds ?? 0) >= 1)
const effectiveSpeed = computed(() => {
  if (!character.value) return 0
  return character.value.speed - (speedWoundPenalty.value ? 2 : 0)
})
const speedTooltip = computed(() => {
  if (!character.value) return ''
  const base = `3 + floor(Agility ${character.value.attribute(AttributeId.Agility)} / 2)`
  return speedWoundPenalty.value ? `${base}, - 2 (Wound)` : base
})

/** "While mounted, your Speed is effectively replaced by the mount's" - but a Wound reduces
 * "your Speed" generally, so the -2 penalty still applies to whichever Speed is currently in
 * effect, mounted or not. */
const mountedSpeedValue = computed(() => {
  if (!character.value || !mount.value) return 0
  const base = mountedSpeed(mount.value, character.value.attribute(mount.value.ridingAttribute))
  return base - (speedWoundPenalty.value ? 2 : 0)
})
const mountedSpeedTooltip = computed(() => {
  if (!character.value || !mount.value) return ''
  const attrName = attributeName(mount.value.ridingAttribute)
  const attrValue = character.value.attribute(mount.value.ridingAttribute)
  const base = `${mount.value.baseSpeed} + floor(${attrName} ${attrValue} / 2) - replaces your own Speed while mounted`
  return speedWoundPenalty.value ? `${base}, - 2 (Wound)` : base
})

const hpTooltip = computed(() => {
  if (!character.value) return ''
  const bonus = modifiers.value.healthBarBonus ? ` + ${modifiers.value.healthBarBonus} (Talent bonus)` : ''
  return `Health Bar (Brawn ${character.value.attribute(AttributeId.Brawn)} + Skirmish ${character.value.skill(SkillId.Skirmish)}${bonus}) x 3`
})
const willpowerTooltip = computed(() => {
  if (!character.value) return ''
  const bonus = modifiers.value.willpowerBonus ? ` + ${modifiers.value.willpowerBonus} (Talent bonus)` : ''
  return `Faith ${character.value.attribute(AttributeId.Faith)}${bonus}`
})

/** Each of the 3 Health Bars covers one Health Bar's worth of Max HP - barIndex 0 is the first
 * to empty (at or below 2/3 Max HP, triggering Wound 1), barIndex 2 the last (empty at 0 HP,
 * Incapacitated). */
function hpBarFilled(barIndex: number): number {
  if (!character.value || !store.character) return 0
  const hb = character.value.healthBar
  const rangeStart = (2 - barIndex) * hb
  return Math.max(0, Math.min(hb, store.character.currentHp - rangeStart))
}

/** "Wound 1: reduced by at least 1 Health Bar (<= 2/3 Max HP) - Speed reduced by 2. Wound 2:
 * reduced by at least 2 Health Bars (<= 1/3 Max HP) - cannot take Swift Tasks, and Wound 1's
 * Speed penalty still applies," per Chapter Three's Wounds rules. */
const woundText = computed(() => {
  const wounds = character.value?.wounds ?? 0
  if (wounds === 0) return null
  if (wounds === 1) return 'Wound 1: Speed is reduced by 2.'
  return 'Wound 2: Speed is reduced by 2, and you cannot take Swift Tasks.'
})

/** "If a Character's Willpower reaches 0, they are Rattled, and all tasks increase in
 * Difficulty by 1. A character can clear Rattled as soon as any amount of Willpower is
 * restored," per Chapter Three. */
const rattledText = computed(() => {
  if (!character.value?.isRattled) return null
  return 'Rattled: All Tasks increase in Difficulty by 1. Clears as soon as you regain any Willpower.'
})
</script>

<template>
  <v-container v-if="store.loading">
    <v-progress-circular indeterminate />
  </v-container>

  <v-container v-else-if="store.notFound">
    <p>Character not found.</p>
    <v-btn to="/sheet">Back to Characters</v-btn>
  </v-container>

  <v-container v-else-if="character && store.character">
    <div class="d-flex align-center justify-space-between mb-1 flex-wrap ga-2">
      <h2 class="text-h5">{{ character.name || 'Unnamed Character' }}</h2>
      <div class="d-flex align-center ga-2">
        <v-btn variant="text" size="small" @click="exportCharacterToFile(store.character)">Export</v-btn>
        <v-btn variant="text" size="small" to="/sheet">Back to Characters</v-btn>
      </div>
    </div>
    <div class="d-flex align-center mb-4">
      <p class="text-body-2 text-medium-emphasis mr-4 mb-0">Level {{ character.level }}</p>
      <v-btn size="small" icon="mdi-minus" variant="text" @click="store.adjustXp(-1)" />
      <span class="mx-1 text-body-2">XP {{ store.character.xp }} / {{ CoreContent.advancement.xpThresholdPerLevel }}</span>
      <v-btn size="small" icon="mdi-plus" variant="text" @click="store.adjustXp(1)" />
      <v-btn
        class="ml-4"
        color="primary"
        size="small"
        :disabled="!canLevelUp"
        @click="showLevelUp = true"
      >
        {{ canLevelUp ? 'Level Up' : 'Max Level Reached' }}
      </v-btn>
      <v-btn
        v-if="canRevertLevelUp"
        class="ml-2"
        variant="text"
        size="small"
        @click="showRevertConfirm = true"
      >
        Revert to Level {{ character.level - 1 }}
      </v-btn>
    </div>

    <LevelUpDialog
      v-model="showLevelUp"
      :character="store.character"
      @confirm="store.levelUp"
    />
    <v-dialog v-model="showRevertConfirm" max-width="480">
      <v-card>
        <v-card-title>Revert to Level {{ character.level - 1 }}?</v-card-title>
        <v-card-text>
          This undoes everything granted or chosen at Level {{ character.level }} - Attribute/Skill
          points, Talents, Focuses, and any "Instead, You May Also" swaps - restoring exactly what
          the character had beforehand. This cannot be redone automatically.
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showRevertConfirm = false">Cancel</v-btn>
          <v-btn color="error" @click="confirmRevertLevelUp">Revert</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <LoadoutEditorDialog
      v-model="showLoadoutEditor"
      :character="store.character"
      @change="store.updateEquipment"
    />
    <SpellEditorDialog
      v-model="showSpellEditor"
      :character="store.character"
      :spell-slots="character.spellSlots"
      @change="store.updatePreparedSpells"
    />
    <EditLifepathDialog
      v-model="showEditLifepath"
      :character="store.character"
      @change="store.updateLifepathTraits"
    />

    <!-- Top of the visual hierarchy: Attributes/Skills as vertical columns on the left, Effect
         Saves nestled next to each Attribute, and every other derived stat as its own prominent,
         hoverable tile to the right. -->
    <v-row class="mb-2">
      <v-col cols="12" sm="6" md="3">
        <div class="text-subtitle-2 mb-1">Attributes</div>
        <v-card v-for="attr in CoreContent.attributes" :key="attr.id" variant="outlined" class="mb-2">
          <v-card-text class="text-center py-2">
            <div class="text-body-2 text-medium-emphasis mb-1">{{ attr.name }}</div>
            <div class="d-flex align-center justify-center" style="gap: 8px">
              <strong class="text-h6">{{ character.attribute(attr.id) }}</strong>
              <DerivedValueBadge
                :display="`Save ${character.effectSave(attr.id)}`"
                :tooltip="effectSaveTooltip(attr.id)"
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="6" md="3">
        <div class="text-subtitle-2 mb-1">Skills</div>
        <v-card v-for="skill in CoreContent.skills" :key="skill.id" variant="outlined" class="mb-2">
          <v-card-text class="text-center py-2">
            <div class="text-body-2 text-medium-emphasis mb-1">{{ skill.name }}</div>
            <strong class="text-h6">{{ character.skill(skill.id) }}</strong>
            <div v-if="store.character.combatSkillFocuses.includes(skill.id)">
              <TooltipChip
                label="Combat Focus"
                tooltip="Gains an expanded crit range on Tasks using this Skill in combat, instead of relying on written Focuses."
              />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card variant="outlined" class="mb-2">
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">HP</span>
              <div class="d-flex align-center" style="gap: 4px">
                <span v-if="editingStat !== 'hp'" class="current-value-display" @click="startEdit('hp')">
                  {{ store.character.currentHp }}
                </span>
                <v-text-field
                  v-else
                  v-model.number="editValue"
                  type="number"
                  density="compact"
                  hide-details
                  class="current-value-input"
                  style="max-width: 64px"
                  @blur="commitEdit"
                  @keyup.enter="commitEdit"
                />
                <span class="text-medium-emphasis">/</span>
                <DerivedValueBadge :display="`${character.maxHp}`" :tooltip="hpTooltip" />
              </div>
            </div>
            <div class="d-flex flex-column" style="gap: 3px">
              <SegmentedBar
                v-for="i in 3"
                :key="i"
                :filled="hpBarFilled(i - 1)"
                :total="character.healthBar"
                :color="HP_BAR_COLOR"
                interactive
                :range-start="(2 - (i - 1)) * character.healthBar"
                :current-value="store.character.currentHp"
                @pick="pickHp"
              />
            </div>
            <div class="d-flex align-center justify-center mt-2 flex-wrap" style="gap: 12px">
              <div class="d-flex align-center" style="gap: 8px">
                <span class="text-caption text-medium-emphasis">Temp HP</span>
                <v-text-field
                  v-model="tempHpDraft"
                  type="number"
                  min="0"
                  max="50"
                  density="compact"
                  hide-details
                  class="no-spin-buttons centered-number-input"
                  style="max-width: 70px"
                  @focus="tempHpFocused = true"
                  @blur="commitTempHp"
                  @keyup.enter="blurActiveElement"
                />
              </div>
              <v-btn size="small" variant="tonal" color="error" @click="openAdjustDialog('hp', 'damage')">
                Take Damage
              </v-btn>
              <v-btn size="small" variant="tonal" color="success" @click="openAdjustDialog('hp', 'recover')">
                Recover
              </v-btn>
              <v-btn size="small" variant="tonal" :disabled="previousHp === null" @click="undoHp">
                Undo
              </v-btn>
            </div>
            <div v-if="woundText" class="text-caption mt-2" :style="{ color: HP_BAR_COLOR }">
              {{ woundText }}
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-2">
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">Willpower</span>
              <div class="d-flex align-center" style="gap: 4px">
                <span
                  v-if="editingStat !== 'willpower'"
                  class="current-value-display"
                  @click="startEdit('willpower')"
                >
                  {{ store.character.currentWillpower }}
                </span>
                <v-text-field
                  v-else
                  v-model.number="editValue"
                  type="number"
                  density="compact"
                  hide-details
                  class="current-value-input"
                  style="max-width: 64px"
                  @blur="commitEdit"
                  @keyup.enter="commitEdit"
                />
                <span class="text-medium-emphasis">/</span>
                <DerivedValueBadge :display="`${character.maxWillpower}`" :tooltip="willpowerTooltip" />
              </div>
            </div>
            <SegmentedBar
              :filled="store.character.currentWillpower"
              :total="character.maxWillpower"
              :color="WILLPOWER_BAR_COLOR"
            />
            <div class="d-flex justify-center mt-2" style="gap: 8px">
              <v-btn size="small" variant="tonal" color="error" @click="openAdjustDialog('willpower', 'damage')">
                Take Damage
              </v-btn>
              <v-btn size="small" variant="tonal" color="success" @click="openAdjustDialog('willpower', 'recover')">
                Recover
              </v-btn>
            </div>
            <div v-if="rattledText" class="text-caption mt-2" :style="{ color: WILLPOWER_BAR_COLOR }">
              {{ rattledText }}
            </div>
          </v-card-text>
        </v-card>

        <v-dialog v-model="adjustDialog.show" max-width="320" @after-enter="focusAdjustInput">
          <v-card>
            <v-card-title>
              {{ adjustDialog.mode === 'damage' ? 'Take Damage' : 'Recover' }}
              ({{ adjustDialog.stat === 'hp' ? 'HP' : 'Willpower' }})
            </v-card-title>
            <v-card-text>
              <v-text-field
                v-model.number="adjustDialog.amount"
                type="number"
                label="Amount"
                density="compact"
                class="adjust-dialog-input"
                @keyup.enter="confirmAdjustDialog"
              />
              <template v-if="adjustDialog.stat === 'hp' && adjustDialog.mode === 'damage'">
                <v-checkbox
                  v-model="adjustDialog.applyResistance"
                  label="Apply Resistance"
                  density="compact"
                  hide-details
                />
                <v-checkbox
                  v-model="adjustDialog.tempHpFirst"
                  label="Temp HP first"
                  density="compact"
                  hide-details
                />
              </template>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="adjustDialog.show = false">Cancel</v-btn>
              <v-btn color="primary" @click="confirmAdjustDialog">
                {{ adjustDialog.mode === 'damage' ? 'Apply Damage' : 'Apply Recovery' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <v-row dense>
          <v-col cols="6" sm="6">
            <v-card variant="tonal" class="resistance-tile">
              <div class="text-caption text-medium-emphasis">Resistance</div>
              <DerivedValueBadge :display="`${character.resistance}`" :tooltip="resistanceTooltip" />

              <div class="d-flex align-start justify-center mt-2" style="gap: 24px">
                <div>
                  <div class="text-caption text-medium-emphasis">Temporary</div>
                  <v-text-field
                    v-model="tempResistanceDraft"
                    type="number"
                    min="0"
                    max="5"
                    density="compact"
                    hide-details
                    class="no-spin-buttons centered-number-input mx-auto"
                    style="max-width: 70px"
                    @focus="tempResistanceFocused = true"
                    @blur="commitTempResistance"
                    @keyup.enter="blurActiveElement"
                  />
                </div>
                <div>
                  <div class="text-caption text-medium-emphasis">Total</div>
                  <DerivedValueBadge
                    :display="`${character.totalResistance}`"
                    :tooltip="totalResistanceTooltip"
                  />
                </div>
              </div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="6">
            <v-card variant="tonal" class="resistance-tile">
              <div class="text-caption text-medium-emphasis">Speed</div>
              <DerivedValueBadge
                :display="`${effectiveSpeed}`"
                :tooltip="speedTooltip"
                :warn="speedWoundPenalty"
              />

              <template v-if="mount">
                <div class="text-caption text-medium-emphasis mt-2">Mounted Speed</div>
                <DerivedValueBadge
                  :display="`${mountedSpeedValue}`"
                  :tooltip="mountedSpeedTooltip"
                  :warn="speedWoundPenalty"
                />
              </template>
            </v-card>
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="7">
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span>Equipment</span>
            <div class="d-flex align-center ga-3">
              <span class="text-body-2 text-medium-emphasis">
                Inventory Slots: {{ usedInventorySlots }} / {{ MAX_INVENTORY_SLOTS }}
              </span>
              <v-btn size="small" variant="tonal" @click="showLoadoutEditor = true">Edit Loadout</v-btn>
            </div>
          </v-card-title>
          <v-card-text>
            <div class="text-subtitle-2 mb-1">Weapons</div>
            <div v-if="!equippedWeaponGroups.length" class="text-medium-emphasis mb-2">None equipped</div>
            <v-card v-for="g in equippedWeaponGroups" :key="g.weapon.id" variant="tonal" class="mb-2">
              <v-card-title class="text-subtitle-1">
                {{ g.weapon.name }}<span v-if="g.count > 1"> x{{ g.count }}</span>
              </v-card-title>
              <v-card-text>
                <v-row dense>
                  <v-col cols="6" sm="3">Task: <strong>{{ weaponTask(g.weapon) }}</strong></v-col>
                  <v-col cols="6" sm="3">Defended by: <strong>{{ weaponDefendedBy(g.weapon) }}</strong></v-col>
                  <v-col cols="6" sm="3">{{ weaponRangeOrReach(g.weapon).label }}: <strong>{{ weaponRangeOrReach(g.weapon).value }}</strong></v-col>
                  <v-col cols="6" sm="3">
                    Damage:
                    <DerivedValueBadge :display="weaponDamageDisplay(g.weapon)" :tooltip="weaponDamageTooltip(g.weapon)" />
                  </v-col>
                </v-row>
                <div class="mt-1">
                  <TooltipChip
                    v-for="effect in g.weapon.damageEffects"
                    :key="effect"
                    :label="damageEffectLabel(effect)"
                    :tooltip="damageEffectTooltip(effect)"
                  />
                  <TooltipChip
                    v-for="(q, i) in g.weapon.qualities"
                    :key="i"
                    :label="qualityLabel(q)"
                    :tooltip="qualityTooltip(q)"
                  />
                </div>
              </v-card-text>
            </v-card>

            <div class="text-subtitle-2 mb-1">Armor</div>
            <div class="text-medium-emphasis mb-2">
              <template v-if="equippedArmor">
                <span class="mr-2">{{ equippedArmor.name }} (Resistance {{ equippedArmor.resistance }})</span>
                <TooltipChip
                  v-for="(q, i) in equippedArmor.qualities"
                  :key="i"
                  :label="qualityLabel(q)"
                  :tooltip="qualityTooltip(q)"
                />
              </template>
              <span v-else>None equipped</span>
            </div>

            <div class="text-subtitle-2 mb-1">Inventory</div>
            <div v-if="!inventoryGroups.length" class="text-medium-emphasis mb-2">Empty</div>
            <div v-for="g in inventoryGroups" :key="g.item.id" class="mb-2">
              <v-tooltip
                v-if="generalItemDescriptions.get(g.item.id)"
                :text="generalItemDescriptions.get(g.item.id)"
                location="top"
                max-width="320"
              >
                <template #activator="{ props: activatorProps }">
                  <span v-bind="activatorProps" class="mr-2 item-name-hoverable">
                    {{ g.item.name }}<span v-if="g.count > 1"> x{{ g.count }}</span>
                  </span>
                </template>
              </v-tooltip>
              <span v-else class="mr-2">{{ g.item.name }}<span v-if="g.count > 1"> x{{ g.count }}</span></span>
              <TooltipChip
                v-for="(q, qi) in g.item.qualities"
                :key="qi"
                :label="qualityLabel(q)"
                :tooltip="qualityTooltip(q)"
              />
            </div>

            <template v-if="mount">
              <div class="text-subtitle-2 mb-1">Mount</div>
              <v-card variant="tonal" class="mb-2">
                <v-card-title class="text-subtitle-1">{{ mount.name }}</v-card-title>
                <v-card-text>
                  <v-row dense>
                    <v-col cols="6" sm="4">Riding: <strong>{{ attributeName(mount.ridingAttribute) }}</strong></v-col>
                    <v-col cols="6" sm="4">
                      Speed:
                      <DerivedValueBadge
                        :display="`${mountedSpeedValue}`"
                        :tooltip="mountedSpeedTooltip"
                        :warn="speedWoundPenalty"
                      />
                    </v-col>
                  </v-row>
                  <div class="mt-1">
                    <TooltipChip v-if="mount.canFly" label="Flies" />
                    <TooltipChip
                      v-if="mount.groundImmobile"
                      label="Ground Immobile"
                      tooltip="Cannot move on the ground; must be flying to move."
                    />
                  </div>
                  <p v-if="mount.specialRules" class="text-body-2 text-medium-emphasis mt-1 mb-0">
                    {{ mount.specialRules }}
                  </p>
                </v-card-text>
              </v-card>
            </template>
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
            Talents
            <v-btn-toggle v-model="talentCategoryFilter" mandatory density="compact" color="primary" variant="outlined">
              <v-btn :value="TalentCategory.Narrative" size="small">Narrative</v-btn>
              <v-btn :value="TalentCategory.Combat" size="small">Combat</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <v-card v-for="t in filteredHeldTalents" :key="t.id" variant="tonal" class="mb-2">
              <v-card-title class="text-subtitle-1">{{ t.name }}</v-card-title>
              <v-card-subtitle>{{ t.group }}<span v-if="t.tier"> - Tier {{ t.tier }}</span></v-card-subtitle>
              <v-card-text><MarkdownText :source="t.effectText" /></v-card-text>
            </v-card>
            <span v-if="!filteredHeldTalents.length" class="text-medium-emphasis">None</span>
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span>Focuses</span>
            <v-btn-toggle v-model="focusesMode" mandatory density="compact" color="primary" variant="outlined">
              <v-btn value="view" size="small">View</v-btn>
              <v-btn value="edit" size="small">Edit</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <template v-if="focusesMode === 'view'">
              <v-chip v-for="(f, i) in store.character.focuses" :key="i" class="mr-1 mb-1" size="small">{{ f }}</v-chip>
              <span v-if="!store.character.focuses.length" class="text-medium-emphasis">None</span>
            </template>
            <template v-else>
              <v-text-field
                v-for="(_, i) in focusDrafts"
                :key="i"
                v-model="focusDrafts[i]"
                variant="underlined"
                density="compact"
                hide-details
                class="mb-1"
                @focus="editingFocusIndex = i"
                @blur="editingFocusIndex = null"
                @update:model-value="(text) => commitFocusText(i, text as string)"
              />
              <span v-if="!store.character.focuses.length" class="text-medium-emphasis">None</span>
            </template>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title>Values</v-card-title>
          <v-card-text>
            <div class="d-flex align-center justify-space-between flex-wrap ga-2 mb-3">
              <span class="text-subtitle-2">Determination</span>
              <div class="d-flex align-center" style="gap: 10px">
                <v-btn
                  size="small"
                  variant="tonal"
                  :disabled="store.character.determination <= 0"
                  @click="store.adjustDetermination(-1)"
                >
                  Spend
                </v-btn>
                <div class="d-flex align-center" style="gap: 4px">
                  <v-icon
                    v-for="i in 3"
                    :key="i"
                    :icon="i <= store.character.determination ? 'mdi-circle' : 'mdi-circle-outline'"
                    color="primary"
                    size="22"
                  />
                </div>
                <v-btn
                  size="small"
                  variant="tonal"
                  :disabled="store.character.determination >= 3"
                  @click="store.adjustDetermination(1)"
                >
                  Gain
                </v-btn>
              </div>
            </div>
            <v-divider class="mb-2" />

            <div class="values-grid values-header text-caption text-medium-emphasis">
              <span />
              <span class="text-center">Called Upon</span>
              <span class="text-center">Challenge</span>
            </div>

            <template v-for="(v, i) in store.character.values" :key="i">
              <div class="values-grid py-1">
                <v-textarea
                  v-model="valueDrafts[i]"
                  variant="underlined"
                  density="compact"
                  placeholder="Value"
                  hide-details
                  auto-grow
                  rows="1"
                  class="value-text"
                  :class="{ 'value-inactive': !v.active || v.challenged, 'value-challenged': v.challenged }"
                  @focus="editingValueIndex = i"
                  @blur="editingValueIndex = null"
                  @update:model-value="(text) => commitValueText(i, text as string)"
                />
                <div class="d-flex justify-center">
                  <v-checkbox
                    :model-value="!v.active"
                    :aria-label="`Called Upon: ${v.text}`"
                    density="compact"
                    hide-details
                    :disabled="v.challenged"
                    @update:model-value="store.toggleValueActive(i)"
                  />
                </div>
                <div class="d-flex justify-center">
                  <v-checkbox
                    :model-value="v.challenged"
                    :aria-label="`Challenge: ${v.text}`"
                    density="compact"
                    hide-details
                    @update:model-value="store.toggleValueChallenged(i)"
                  />
                </div>
              </div>
            </template>

            <v-divider class="my-2" />

            <div class="values-grid py-1">
              <v-textarea
                v-model="commonCauseDraft"
                variant="underlined"
                density="compact"
                placeholder="Common Cause"
                hide-details
                auto-grow
                rows="1"
                class="value-text"
                :class="{
                  'value-inactive': !store.character.commonCause.active || store.character.commonCause.challenged,
                  'value-challenged': store.character.commonCause.challenged,
                }"
                @focus="editingCommonCause = true"
                @blur="editingCommonCause = false"
                @update:model-value="(text) => commitCommonCauseText(text as string)"
              />
              <div class="d-flex justify-center">
                <v-checkbox
                  :model-value="!store.character.commonCause.active"
                  aria-label="Called Upon: Common Cause"
                  density="compact"
                  hide-details
                  :disabled="store.character.commonCause.challenged"
                  @update:model-value="store.toggleCommonCauseActive()"
                />
              </div>
              <div class="d-flex justify-center">
                <v-checkbox
                  :model-value="store.character.commonCause.challenged"
                  aria-label="Challenge: Common Cause"
                  density="compact"
                  hide-details
                  @update:model-value="store.toggleCommonCauseChallenged()"
                />
              </div>
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span>Traits</span>
            <v-btn size="small" variant="tonal" @click="showEditLifepath = true">Edit Lifepath</v-btn>
          </v-card-title>
          <v-card-text>
            <v-chip v-for="(t, i) in store.character.traits" :key="i" class="mr-1 mb-1" size="small" color="secondary">
              {{ t.name }}
            </v-chip>
            <span v-if="!store.character.traits.length" class="text-medium-emphasis">None</span>
          </v-card-text>
        </v-card>

        <v-card v-if="isSpellcaster" variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
            <span>Spells</span>
            <div class="d-flex align-center ga-3">
              <span class="text-body-2 text-medium-emphasis">
                Spell Slots: {{ usedSpellSlots }} / {{ character.spellSlots }}
              </span>
              <v-btn size="small" variant="tonal" @click="showSpellEditor = true">Edit Spells</v-btn>
            </div>
          </v-card-title>
          <v-card-text>
            <SpellsSection :character="character" :prepared-spell-ids="store.character.preparedSpellIds" />
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-title>Notes</v-card-title>
          <v-card-text>
            <NotesEditor :model-value="store.character.notes" @change="store.updateNotes" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.item-name-hoverable {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
}

.resistance-tile {
  padding: 12px 8px;
  text-align: center;
  height: 100%;
}

.current-value-display {
  cursor: pointer;
  font-weight: 600;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  padding: 0 2px;
}

/* Hide the native up/down spinner - these are small "type an exact number" fields, not ones
   meant to be nudged a click at a time. */
.no-spin-buttons :deep(input[type='number'])::-webkit-inner-spin-button,
.no-spin-buttons :deep(input[type='number'])::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.no-spin-buttons :deep(input[type='number']) {
  -moz-appearance: textfield;
}

.centered-number-input :deep(input) {
  text-align: center;
}

.values-grid {
  display: grid;
  grid-template-columns: 1fr 64px 64px;
  align-items: start;
  column-gap: 8px;
}
.values-header {
  padding-bottom: 2px;
  align-items: center;
}
.values-header span {
  white-space: normal;
  line-height: 1.1;
}
.values-grid > div {
  padding-top: 6px;
}

.value-text :deep(textarea) {
  font-size: 1.15rem;
  line-height: 1.4;
}
.value-text.value-inactive :deep(textarea) {
  opacity: var(--v-medium-emphasis-opacity, 0.6);
}
.value-text.value-challenged :deep(textarea) {
  text-decoration: line-through;
}
</style>
