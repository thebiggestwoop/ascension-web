<script setup lang="ts">
import { computed, onMounted, toRaw, watch } from 'vue'
import { CoreContent } from '@/io/ContentLoader'
import { Character, computeStatModifiers } from '@/classes/Character'
import { useCharacterSheetStore } from './store/CharacterSheetStore'

const props = defineProps<{ id: string }>()
const store = useCharacterSheetStore()

onMounted(() => store.loadById(props.id))
watch(() => props.id, (id) => store.loadById(id))

const allTalents = [...CoreContent.talents.narrative, ...CoreContent.talents.combat]

const character = computed(() => {
  if (!store.character) return null
  const modifiers = computeStatModifiers(
    toRaw(store.character),
    allTalents,
    CoreContent.equipment.armor,
    CoreContent.equipment.general,
  )
  return Character.Deserialize(toRaw(store.character), modifiers)
})

const heldTalents = computed(() => {
  if (!store.character) return []
  const ids = store.character.talentIds
  return allTalents.filter((t) => ids.includes(t.id))
})

const equippedWeapons = computed(() => {
  if (!store.character) return []
  return CoreContent.equipment.weapons.filter((w) => store.character!.equippedWeaponIds.includes(w.id))
})

const equippedArmor = computed(() =>
  store.character?.equippedArmorId
    ? CoreContent.equipment.armor.find((a) => a.id === store.character!.equippedArmorId)
    : undefined,
)

const allInventoryItems = [...CoreContent.equipment.shields, ...CoreContent.equipment.general]
const inventoryItems = computed(() => {
  if (!store.character) return []
  const ids = store.character.inventoryItemIds
  return allInventoryItems.filter((i) => ids.includes(i.id))
})

const mount = computed(() =>
  store.character?.mountId ? CoreContent.equipment.mounts.find((m) => m.id === store.character!.mountId) : undefined,
)
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
    <p class="text-body-2 text-medium-emphasis mb-4">Level {{ character.level }}</p>

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
          <v-card-title>Equipment</v-card-title>
          <v-card-text>
            <div class="text-subtitle-2 mb-1">Weapons</div>
            <div v-if="!equippedWeapons.length" class="text-medium-emphasis mb-2">None equipped</div>
            <v-chip v-for="w in equippedWeapons" :key="w.id" class="mr-1 mb-2" size="small">
              {{ w.name }} ({{ w.damageCD }}[CD])
            </v-chip>

            <div class="text-subtitle-2 mb-1">Armor</div>
            <div class="text-medium-emphasis mb-2">
              {{ equippedArmor ? `${equippedArmor.name} (Resistance ${equippedArmor.resistance})` : 'None equipped' }}
            </div>

            <div class="text-subtitle-2 mb-1">Inventory</div>
            <div v-if="!inventoryItems.length" class="text-medium-emphasis mb-2">Empty</div>
            <v-chip v-for="i in inventoryItems" :key="i.id" class="mr-1 mb-2" size="small">{{ i.name }}</v-chip>

            <template v-if="mount">
              <div class="text-subtitle-2 mb-1">Mount</div>
              <div class="text-medium-emphasis">{{ mount.name }}</div>
            </template>
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
