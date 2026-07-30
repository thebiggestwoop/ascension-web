<script setup lang="ts">
import { SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import EquipmentPicker from '@/features/character_builder/components/EquipmentPicker.vue'

defineProps<{ modelValue: boolean; character: ICharacterData }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [
    payload: {
      equippedWeaponIds: string[]
      equippedArmorId?: string
      inventoryItemIds: string[]
      mountId?: string
    },
  ]
}>()
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="700"
    scrollable
    @update:model-value="(v) => emit('update:modelValue', v)"
  >
    <v-card>
      <v-card-title>Edit Loadout</v-card-title>
      <v-card-text style="max-height: 75vh">
        <!-- v-if remounts the picker fresh each time the dialog opens, so its internal
             counts always re-initialize from the character's current equipment. -->
        <EquipmentPicker
          v-if="modelValue"
          :initial-equipped-weapon-ids="character.equippedWeaponIds"
          :initial-equipped-armor-id="character.equippedArmorId"
          :initial-inventory-item-ids="character.inventoryItemIds"
          :initial-mount-id="character.mountId"
          :talent-ids="character.talentIds"
          :skirmish-skill="character.skills[SkillId.Skirmish]"
          @change="(p) => emit('change', p)"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="emit('update:modelValue', false)">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
