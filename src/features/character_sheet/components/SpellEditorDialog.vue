<script setup lang="ts">
import type { ICharacterData } from '@/classes/Character'
import SpellPicker from './SpellPicker.vue'

defineProps<{ modelValue: boolean; character: ICharacterData; spellSlots: number }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  change: [ids: string[]]
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
      <v-card-title>Edit Prepared Spells</v-card-title>
      <v-card-text style="max-height: 75vh">
        <!-- v-if remounts the picker fresh each time the dialog opens, so its internal
             counts always re-initialize from the character's current prepared spells. -->
        <SpellPicker
          v-if="modelValue"
          :talent-ids="character.talentIds"
          :initial-prepared-spell-ids="character.preparedSpellIds"
          :spell-slots="spellSlots"
          @change="(ids) => emit('change', ids)"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" @click="emit('update:modelValue', false)">Done</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
