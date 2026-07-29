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
import SpellsSection from './components/SpellsSection.vue'
import TooltipChip from '@/ui/TooltipChip.vue'

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

const props = defineProps<{ id: string }>()
const store = useCharacterSheetStore()
const showLevelUp = ref(false)
const showLoadoutEditor = ref(false)
const canLevelUp = computed(() => (store.character?.level ?? 0) < CoreContent.advancement.maxLevel)

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
const character = computed(() => {
  if (!store.character) return null
  const modifiers = computeStatModifiers(
    store.character,
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
  )
  return new Character(store.character, modifiers)
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

function weaponRangeOrReach(weapon: IWeaponData): { label: string; value: number | string } {
  if (weapon.range) return { label: 'Range', value: weapon.range }
  const extended = weapon.qualities.find((q) => q.quality === EquipmentQuality.Extended)
  return { label: 'Reach', value: extended?.value ?? 1 }
}

function weaponDamage(weapon: IWeaponData): string {
  if (!character.value) return `${weapon.damageCD}[CD]`
  return `${weapon.damageCD + character.value.damageBonus}[CD]`
}
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
    </div>

    <LevelUpDialog
      v-model="showLevelUp"
      :character="store.character"
      @confirm="store.levelUp"
    />
    <LoadoutEditorDialog
      v-model="showLoadoutEditor"
      :character="store.character"
      @change="store.updateEquipment"
    />

    <v-row>
      <v-col cols="12" md="7">
        <v-card variant="outlined" class="mb-4">
          <v-card-title>Health &amp; Willpower</v-card-title>
          <v-card-text>
            <div class="d-flex align-center mb-2">
              <span class="mr-2" style="width: 90px">HP</span>
              <v-btn size="small" icon="mdi-minus" variant="tonal" @click="store.adjustHp(-1, character.maxHp)" />
              <span class="mx-3">{{ store.character.currentHp }} / {{ character.maxHp }}</span>
              <v-btn size="small" icon="mdi-plus" variant="tonal" @click="store.adjustHp(1, character.maxHp)" />
            </div>
            <div class="d-flex align-center">
              <span class="mr-2" style="width: 90px">Willpower</span>
              <v-btn
                size="small"
                icon="mdi-minus"
                variant="tonal"
                @click="store.adjustWillpower(-1, character.maxWillpower)"
              />
              <span class="mx-3">{{ store.character.currentWillpower }} / {{ character.maxWillpower }}</span>
              <v-btn
                size="small"
                icon="mdi-plus"
                variant="tonal"
                @click="store.adjustWillpower(1, character.maxWillpower)"
              />
            </div>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title>Derived Stats</v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col cols="6" sm="4">Speed: <strong>{{ character.speed }}</strong></v-col>
              <v-col cols="6" sm="4">Resistance: <strong>{{ character.resistance }}</strong></v-col>
              <v-col cols="6" sm="4">Damage Bonus: <strong>{{ character.damageBonus }}</strong></v-col>
              <v-col cols="6" sm="4">Spell Slots: <strong>{{ character.spellSlots }}</strong></v-col>
            </v-row>
            <div class="text-subtitle-2 mt-3 mb-1">Effect Saves</div>
            <v-row dense>
              <v-col v-for="attr in CoreContent.attributes" :key="attr.id" cols="6" sm="4">
                {{ attr.name }}: <strong>{{ character.effectSave(attr.id) }}</strong>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card variant="outlined" class="mb-4">
          <v-card-title>Attributes &amp; Skills</v-card-title>
          <v-card-text>
            <div class="text-subtitle-2 mb-1">Attributes</div>
            <v-row dense class="mb-3">
              <v-col v-for="attr in CoreContent.attributes" :key="attr.id" cols="6" sm="4">
                {{ attr.name }}: <strong>{{ character.attribute(attr.id) }}</strong>
              </v-col>
            </v-row>
            <div class="text-subtitle-2 mb-1">Skills</div>
            <v-row dense>
              <v-col v-for="skill in CoreContent.skills" :key="skill.id" cols="6" sm="4">
                {{ skill.name }}: <strong>{{ character.skill(skill.id) }}</strong>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

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
                  <v-col cols="6" sm="3">{{ weaponRangeOrReach(g.weapon).label }}: <strong>{{ weaponRangeOrReach(g.weapon).value }}</strong></v-col>
                  <v-col cols="6" sm="3">Damage: <strong>{{ weaponDamage(g.weapon) }}</strong></v-col>
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
              <span class="mr-2">{{ g.item.name }}<span v-if="g.count > 1"> x{{ g.count }}</span></span>
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
          <v-card-title>Spells</v-card-title>
          <v-card-text>
            <SpellsSection
              :talent-ids="store.character.talentIds"
              :prepared-spell-ids="store.character.preparedSpellIds"
              :spell-slots="character.spellSlots"
              @change="store.updatePreparedSpells"
            />
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
