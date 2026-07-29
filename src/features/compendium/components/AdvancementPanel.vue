<script setup lang="ts">
import { CoreContent } from '@/io/ContentLoader'

const adv = CoreContent.advancement
</script>

<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-3">
      Starting Level {{ adv.startingLevel }}, max Level {{ adv.maxLevel }}. {{ adv.xpThresholdPerLevel }} XP per Level.
      Tier 3 Combat Talents unlock at Level {{ adv.tier3TalentUnlockLevel }}; a second Attribute/Skill may sit at the
      cap starting Level {{ adv.multipleAt11Or4UnlockLevel }}.
    </p>

    <v-table density="compact" class="mb-4">
      <thead>
        <tr>
          <th>Level</th>
          <th>Combat Talents</th>
          <th>Narrative Talents</th>
          <th>Attribute Points</th>
          <th>Skill Points</th>
          <th>New Focus</th>
          <th>Unlocks</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in adv.levelAscensionChart" :key="row.level">
          <td>{{ row.level }}</td>
          <td>{{ row.combatTalents }}</td>
          <td>{{ row.narrativeTalents }}</td>
          <td>{{ row.attributePoints }}</td>
          <td>{{ row.skillPoints }}</td>
          <td>{{ row.newFocus ? 'Yes' : '' }}</td>
          <td>{{ row.unlocks }}</td>
        </tr>
      </tbody>
    </v-table>

    <h3 class="text-h6 mb-2">Experience Points</h3>
    <v-table density="compact" class="mb-4">
      <thead>
        <tr>
          <th>XP</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in adv.experiencePoints" :key="row.xp">
          <td>{{ row.xp }}</td>
          <td>{{ row.description }}</td>
        </tr>
      </tbody>
    </v-table>

    <h3 class="text-h6 mb-2">On Level Up, Instead You May</h3>
    <ul>
      <li v-for="(opt, i) in adv.respecOptions" :key="i">{{ opt }}</li>
    </ul>
  </div>
</template>
