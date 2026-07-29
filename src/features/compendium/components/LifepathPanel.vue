<script setup lang="ts">
import { ref } from 'vue'
import type { AttributeId, SkillId } from '@/classes/enums'
import type { ILifepathGrants, ILifepathStageData } from '@/classes/Lifepath'
import { CoreContent } from '@/io/ContentLoader'

const stages: { stage: ILifepathStageData; label: string }[] = [
  { stage: CoreContent.lifepath.socialClass, label: 'Step One: Social Class' },
  { stage: CoreContent.lifepath.upbringing, label: 'Step Two: Upbringing' },
  { stage: CoreContent.lifepath.education, label: 'Step Three: Education' },
  { stage: CoreContent.lifepath.career, label: 'Step Four: Career' },
  { stage: CoreContent.lifepath.lifeEvents, label: 'Step Five: Life Events' },
]

const activeStageIndex = ref(0)
const finishingTouches = CoreContent.lifepath.finishingTouches

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}
function skillName(id: SkillId): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}

function describeGrants(grants: ILifepathGrants): string[] {
  const lines: string[] = []
  for (const g of grants.attributePoints) {
    if (g.restrictTo?.length === 1) lines.push(`+${g.amount} ${attributeName(g.restrictTo[0])}`)
    else if (g.restrictTo) lines.push(`+${g.amount} to one of ${g.restrictTo.map(attributeName).join(', ')}`)
    else lines.push(`${g.amount} points, split freely across Attributes`)
  }
  for (const g of grants.skillPoints) {
    if (g.restrictTo?.length === 1) lines.push(`+${g.amount} ${skillName(g.restrictTo[0])}`)
    else if (g.restrictTo) lines.push(`+${g.amount} to one of ${g.restrictTo.map(skillName).join(', ')}`)
    else lines.push(`${g.amount} points, split freely across Skills`)
  }
  if (grants.focusCount > 0) {
    lines.push(`${grants.focusCount} Focus${grants.focusCount > 1 ? 'es' : ''}`)
  }
  if (grants.valuePrompt) lines.push('A Value')
  if (grants.trait) lines.push(`Trait: ${grants.trait}`)
  return lines
}
</script>

<template>
  <div>
    <v-tabs v-model="activeStageIndex" class="mb-3">
      <v-tab v-for="(s, i) in stages" :key="s.stage.id" :text="s.label" :value="i" />
      <v-tab :text="'Step Six: Finishing Touches'" :value="stages.length" />
    </v-tabs>

    <div v-if="activeStageIndex < stages.length">
      <p v-if="stages[activeStageIndex].stage.notes" class="text-body-2 text-medium-emphasis mb-3">
        {{ stages[activeStageIndex].stage.notes }}
      </p>
      <v-row>
        <v-col v-for="option in stages[activeStageIndex].stage.options" :key="option.id" cols="12" sm="6" md="4">
          <v-card variant="outlined" class="h-100">
            <v-card-title>{{ option.name }}</v-card-title>
            <v-card-text>
              <p class="mb-2">{{ option.description }}</p>
              <v-chip v-for="(line, i) in describeGrants(option.grants)" :key="i" size="small" class="mr-1 mb-1">
                {{ line }}
              </v-chip>
              <p v-if="option.grants.valuePrompt" class="text-caption text-medium-emphasis mt-2">
                Value prompt: {{ option.grants.valuePrompt }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-card v-else variant="outlined">
      <v-card-title>{{ finishingTouches.name }}</v-card-title>
      <v-card-text>
        <ul class="mb-3">
          <li>
            Attributes: correct any Attribute above {{ finishingTouches.attributeCap.max }} (only
            {{ finishingTouches.attributeCap.maxAtCap }} may sit at the cap), then gain
            +{{ finishingTouches.attributeBonusCount }} freely-split bonus points.
          </li>
          <li>
            Skills: correct any Skill above {{ finishingTouches.skillCap.max }} (only
            {{ finishingTouches.skillCap.maxAtCap }} may sit at the cap), then gain
            +{{ finishingTouches.skillBonusCount }} freely-split bonus points.
          </li>
          <li>+{{ finishingTouches.bonusValueCount }} Value.</li>
          <li>
            {{ finishingTouches.combatTalentGrant.count }} Tier {{ finishingTouches.combatTalentGrant.tier }} Combat
            Talents and {{ finishingTouches.narrativeTalentGrant }} Narrative Talents, chosen freely so long as
            prerequisites are met.
          </li>
          <li>A "Defining Feature" Trait.</li>
          <li>{{ finishingTouches.equipmentGrant }}</li>
        </ul>
        <div class="text-subtitle-2 mb-1">Final Check</div>
        <v-chip class="mr-1 mb-1" size="small">Attributes sum to {{ finishingTouches.finalCheck.attributeSum }}</v-chip>
        <v-chip class="mr-1 mb-1" size="small">Skills sum to {{ finishingTouches.finalCheck.skillSum }}</v-chip>
        <v-chip class="mr-1 mb-1" size="small">{{ finishingTouches.finalCheck.combatTalentTier1Count }} Combat Talents</v-chip>
        <v-chip class="mr-1 mb-1" size="small">{{ finishingTouches.finalCheck.narrativeTalentCount }} Narrative Talents</v-chip>
        <v-chip class="mr-1 mb-1" size="small">{{ finishingTouches.finalCheck.focusCount }} Focuses</v-chip>
        <v-chip class="mr-1 mb-1" size="small">{{ finishingTouches.finalCheck.valueCount }} Values</v-chip>
      </v-card-text>
    </v-card>
  </div>
</template>
