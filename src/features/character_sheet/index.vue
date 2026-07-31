<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { Character, computeStatModifiers } from '@/classes/Character'
import { AttributeId, SkillId } from '@/classes/enums'
import type { IQualityInstance, IWeaponData } from '@/classes/Equipment'
import { EquipmentQuality, WeaponTag } from '@/classes/Equipment'
import { useCharacterSheetStore } from './store/CharacterSheetStore'
import LevelUpDialog from './components/LevelUpDialog.vue'
import LoadoutEditorDialog from './components/LoadoutEditorDialog.vue'
import SpellEditorDialog from './components/SpellEditorDialog.vue'
import SpellsSection from './components/SpellsSection.vue'
import TooltipChip from '@/ui/TooltipChip.vue'
import DerivedValueBadge from '@/ui/DerivedValueBadge.vue'
import StatTile from '@/ui/StatTile.vue'
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
const showRevertConfirm = ref(false)
const canLevelUp = computed(() => (store.character?.level ?? 0) < CoreContent.advancement.maxLevel)
const canRevertLevelUp = computed(() => (store.character?.levelUpHistory?.length ?? 0) > 0)

async function confirmRevertLevelUp() {
  await store.revertLastLevelUp()
  showRevertConfirm.value = false
}

onMounted(() => store.loadById(props.id))
watch(() => props.id, (id) => store.loadById(id))

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

interface IStatTile {
  label: string
  display: string
  tooltip: string
}

/** The character's simple derived stats - Speed/Resistance/Damage Bonus/Spell Slots - each
 * shown as its own prominent tile with a hover tooltip explaining the calculation. HP/Willpower
 * get their own dedicated bar displays instead (see hpTooltip/willpowerTooltip below). */
const derivedTiles = computed<IStatTile[]>(() => {
  if (!character.value) return []
  const c = character.value
  const spellSlotBonusText = modifiers.value.spellSlotBonus ? ` + ${modifiers.value.spellSlotBonus} (Tomes)` : ''
  return [
    {
      label: 'Speed',
      display: `${c.speed}`,
      tooltip: `3 + floor(Agility ${c.attribute(AttributeId.Agility)} / 2)`,
    },
    {
      label: 'Resistance',
      display: `${c.resistance}`,
      tooltip: equippedArmor.value ? `${equippedArmor.value.name}'s Resistance` : 'No Armor equipped',
    },
    {
      label: 'Damage Bonus',
      display: `${c.damageBonus}`,
      tooltip: `Equal to Skirmish Skill (${c.skill(SkillId.Skirmish)})`,
    },
    {
      label: 'Spell Slots',
      display: `${c.spellSlots}`,
      tooltip: `Study ${c.skill(SkillId.Study)}${spellSlotBonusText}`,
    },
  ]
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
    <div class="d-flex align-center justify-space-between mb-1">
      <h2 class="text-h5">{{ character.name || 'Unnamed Character' }}</h2>
      <v-btn variant="text" size="small" to="/sheet">Back to Characters</v-btn>
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
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <v-card variant="outlined" class="mb-2">
          <v-card-text>
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2">Max HP</span>
              <DerivedValueBadge
                :display="`${store.character.currentHp} / ${character.maxHp}`"
                :tooltip="hpTooltip"
              />
            </div>
            <div class="d-flex flex-column" style="gap: 3px">
              <SegmentedBar
                v-for="i in 3"
                :key="i"
                :filled="hpBarFilled(i - 1)"
                :total="character.healthBar"
                :color="HP_BAR_COLOR"
              />
            </div>
            <div class="d-flex justify-center mt-2">
              <v-btn size="x-small" icon="mdi-minus" variant="tonal" @click="store.adjustHp(-1, character.maxHp)" />
              <v-btn
                size="x-small"
                icon="mdi-plus"
                variant="tonal"
                class="ml-2"
                @click="store.adjustHp(1, character.maxHp)"
              />
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
              <DerivedValueBadge
                :display="`${store.character.currentWillpower} / ${character.maxWillpower}`"
                :tooltip="willpowerTooltip"
              />
            </div>
            <SegmentedBar
              :filled="store.character.currentWillpower"
              :total="character.maxWillpower"
              :color="WILLPOWER_BAR_COLOR"
            />
            <div class="d-flex justify-center mt-2">
              <v-btn
                size="x-small"
                icon="mdi-minus"
                variant="tonal"
                @click="store.adjustWillpower(-1, character.maxWillpower)"
              />
              <v-btn
                size="x-small"
                icon="mdi-plus"
                variant="tonal"
                class="ml-2"
                @click="store.adjustWillpower(1, character.maxWillpower)"
              />
            </div>
            <div v-if="rattledText" class="text-caption mt-2" :style="{ color: WILLPOWER_BAR_COLOR }">
              {{ rattledText }}
            </div>
          </v-card-text>
        </v-card>

        <v-row dense>
          <v-col v-for="tile in derivedTiles" :key="tile.label" cols="6" sm="3">
            <StatTile :label="tile.label" :display="tile.display" :tooltip="tile.tooltip" />
          </v-col>
        </v-row>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="7">
        <v-card variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Equipment</span>
            <v-btn size="small" variant="tonal" @click="showLoadoutEditor = true">Edit Loadout</v-btn>
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
              <div class="text-medium-emphasis">{{ mount.name }}</div>
            </template>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Spells</span>
            <v-btn size="small" variant="tonal" @click="showSpellEditor = true">Edit Spells</v-btn>
          </v-card-title>
          <v-card-text>
            <SpellsSection :character="character" :prepared-spell-ids="store.character.preparedSpellIds" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card variant="outlined" class="mb-4">
          <v-card-title>Focuses</v-card-title>
          <v-card-text>
            <v-chip v-for="(f, i) in store.character.focuses" :key="i" class="mr-1 mb-1" size="small">{{ f }}</v-chip>
            <span v-if="!store.character.focuses.length" class="text-medium-emphasis">None</span>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title>Values</v-card-title>
          <v-card-text>
            <v-chip
              v-for="(v, i) in store.character.values"
              :key="i"
              class="mr-1 mb-1"
              size="small"
              :variant="v.active ? 'tonal' : 'outlined'"
              :color="v.active ? 'primary' : undefined"
              @click="store.toggleValueActive(i)"
            >
              {{ v.text }}
            </v-chip>
            <span v-if="!store.character.values.length" class="text-medium-emphasis">None</span>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title>Traits</v-card-title>
          <v-card-text>
            <v-chip v-for="(t, i) in store.character.traits" :key="i" class="mr-1 mb-1" size="small" color="secondary">
              {{ t.name }}
            </v-chip>
            <span v-if="!store.character.traits.length" class="text-medium-emphasis">None</span>
          </v-card-text>
        </v-card>

        <v-card variant="outlined">
          <v-card-title>Talents</v-card-title>
          <v-card-text>
            <v-card v-for="t in heldTalents" :key="t.id" variant="tonal" class="mb-2">
              <v-card-title class="text-subtitle-1">{{ t.name }}</v-card-title>
              <v-card-subtitle>{{ t.group }}<span v-if="t.tier"> - Tier {{ t.tier }}</span></v-card-subtitle>
              <v-card-text>{{ t.effectText }}</v-card-text>
            </v-card>
            <span v-if="!heldTalents.length" class="text-medium-emphasis">None</span>
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
</style>
