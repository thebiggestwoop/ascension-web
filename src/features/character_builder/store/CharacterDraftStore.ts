import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import { Character, computeStatModifiers } from '@/classes/Character'
import type { ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'
import { applyLifepathSelection } from '@/classes/Lifepath'
import type { IFinishingTouchesRecord, IQuickBuildRecord } from '@/classes/CharacterHistory'
import { SPELLCASTER_TALENT_IDS } from '@/classes/Spell'
import { CoreContent } from '@/io/ContentLoader'
import { saveCharacter } from '@/io/Storage'

/**
 * Grants the "Spellcaster" Trait the first time a character picks up any Tier 1 Magick
 * Domain Talent - everything gated on "Requires Spellcaster" (Talents, Spell slots) checks
 * this Trait rather than any specific Talent id.
 */
function grantSpellcasterTraitIfNeeded(draft: ICharacterData, newTalentIds: string[]) {
  const alreadyHasTrait = draft.traits.some((t) => t.name === 'Spellcaster')
  const justBecameSpellcaster = newTalentIds.some((id) => SPELLCASTER_TALENT_IDS.includes(id))
  if (!alreadyHasTrait && justBecameSpellcaster) {
    draft.traits.push({ name: 'Spellcaster' })
  }
}

/** Every character begins at Attributes=6, Skills=1 per Chapter Two. */
function createBaseDraft(): ICharacterData {
  return {
    id: crypto.randomUUID(),
    name: '',
    level: 0,
    xp: 0,
    attributes: {
      [AttributeId.Agility]: 6,
      [AttributeId.Awareness]: 6,
      [AttributeId.Brawn]: 6,
      [AttributeId.Coordination]: 6,
      [AttributeId.Faith]: 6,
      [AttributeId.Presence]: 6,
      [AttributeId.Reason]: 6,
    },
    skills: {
      [SkillId.Skirmish]: 1,
      [SkillId.Authority]: 1,
      [SkillId.Diplomacy]: 1,
      [SkillId.Study]: 1,
      [SkillId.Medicine]: 1,
      [SkillId.Intrigue]: 1,
    },
    focuses: [],
    values: [],
    traits: [],
    combatSkillFocuses: [],
    currentHp: 0,
    currentWillpower: 0,
    temporaryHp: 0,
    temporaryResistance: 0,
    statuses: [],
    determination: 0,
    talentIds: [],
    equippedWeaponIds: [],
    inventoryItemIds: [],
    preparedSpellIds: [],
    levelUpHistory: [],
    notes: '',
  }
}

/**
 * Step Six: Finishing Touches doesn't go through applyLifepathSelection() since it isn't
 * option-driven - the wizard resolves cap correction, bonus points, Value/Trait/Talent/
 * Equipment picks itself and hands the net result here as one batch.
 */
export interface IFinishingTouchesPayload extends IFinishingTouchesRecord {
  name: string
}

/**
 * Quick Build (Standard Array) is the fast-path alternative to the six-step Lifepath: it
 * assigns final Attribute/Skill values directly (not deltas from the base 6/1 draft) since
 * there's no earlier stage to build on top of, then hands over the same Focus/Value/Trait/
 * Talent/Equipment grants as Finishing Touches.
 */
export interface IQuickBuildPayload extends IQuickBuildRecord {
  name: string
}

/**
 * Whichever step is currently active reports its in-progress, not-yet-confirmed picks here so
 * CharacterPreview can show their effect immediately instead of only after "Confirm & Continue"/
 * "Finish Character". `attributes`/`skills` are absolute preview values (not deltas) since Quick
 * Build computes its own from scratch rather than building on `draft`; when unset, the preview
 * just shows `draft` unchanged.
 */
export interface IPendingPreview {
  attributes?: Record<AttributeId, number>
  skills?: Record<SkillId, number>
  focusTexts: string[]
  valueTexts: string[]
  traitNames: string[]
}

function createEmptyPendingPreview(): IPendingPreview {
  return { focusTexts: [], valueTexts: [], traitNames: [] }
}

/**
 * Payload objects assembled by the wizard steps can carry live Vue reactive Proxies nested
 * inside otherwise-plain arrays (e.g. a Talent picker emitting its own ref's array directly) -
 * harmless as long as only their primitive elements are ever read, but fatal if the whole
 * payload is later stored verbatim (creationRecord) inside character data that gets
 * structuredClone()'d (Character.Deserialize does this on every save): a live Proxy anywhere in
 * that graph makes the clone throw "could not be cloned". Round-tripping through JSON guarantees
 * a fully plain copy since JSON.stringify only ever reads a Proxy's own enumerable data.
 */
function toPlainRecord<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const useCharacterDraftStore = defineStore('characterDraft', {
  state: () => ({
    draft: createBaseDraft(),
    completedStageIds: [] as string[],
    /** One entry per completed Lifepath stage, recorded verbatim into creationRecord at
     * Finishing Touches - not used for anything else, since applyLifepathSelection() has
     * already applied each stage's effect to the draft as it was picked. */
    lifepathSelections: [] as ILifepathSelection[],
    pendingPreview: createEmptyPendingPreview() as IPendingPreview,
  }),
  actions: {
    setPendingPreview(preview: Partial<IPendingPreview>) {
      this.pendingPreview = { ...createEmptyPendingPreview(), ...preview }
    },
    clearPendingPreview() {
      this.pendingPreview = createEmptyPendingPreview()
    },
    applyStage(stage: ILifepathStageData, selection: ILifepathSelection) {
      applyLifepathSelection(this.draft, selection, stage)
      this.completedStageIds.push(stage.id)
      this.lifepathSelections.push(selection)
      this.clearPendingPreview()
    },
    async applyFinishingTouches(payload: IFinishingTouchesPayload) {
      this.draft.name = payload.name
      for (const [id, amount] of Object.entries(payload.attributeDeltas)) {
        this.draft.attributes[id as AttributeId] += amount ?? 0
      }
      for (const [id, amount] of Object.entries(payload.skillDeltas)) {
        this.draft.skills[id as SkillId] += amount ?? 0
      }
      this.draft.values.push({ text: payload.valueText, active: true })
      this.draft.traits.push({ name: `Defining Feature: ${payload.definingFeatureText}` })
      this.draft.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)
      grantSpellcasterTraitIfNeeded(this.draft, [...payload.narrativeTalentIds, ...payload.combatTalentIds])
      this.draft.equippedWeaponIds.push(...payload.equippedWeaponIds)
      if (payload.equippedArmorId) this.draft.equippedArmorId = payload.equippedArmorId
      this.draft.inventoryItemIds.push(...payload.inventoryItemIds)
      if (payload.mountId) this.draft.mountId = payload.mountId
      this.draft.preparedSpellIds.push(...payload.preparedSpellIds)
      this.draft.combatSkillFocuses = [...payload.combatSkillFocuses]

      const { name: _name, ...finishingTouches } = payload
      this.draft.creationRecord = toPlainRecord({
        method: 'lifepath' as const,
        lifepathSelections: this.lifepathSelections,
        finishingTouches,
      })
      this.clearPendingPreview()

      await this.finalizeCharacter()
    },
    async applyQuickBuild(payload: IQuickBuildPayload) {
      this.draft.name = payload.name
      this.draft.attributes = { ...payload.attributes }
      this.draft.skills = { ...payload.skills }
      this.draft.focuses.push(...payload.focusTexts)
      for (const text of payload.valueTexts) {
        this.draft.values.push({ text, active: true })
      }
      for (const name of payload.traitNames) {
        this.draft.traits.push({ name })
      }
      this.draft.traits.push({ name: `Defining Feature: ${payload.definingFeatureText}` })
      this.draft.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)
      grantSpellcasterTraitIfNeeded(this.draft, [...payload.narrativeTalentIds, ...payload.combatTalentIds])
      this.draft.equippedWeaponIds.push(...payload.equippedWeaponIds)
      if (payload.equippedArmorId) this.draft.equippedArmorId = payload.equippedArmorId
      this.draft.inventoryItemIds.push(...payload.inventoryItemIds)
      if (payload.mountId) this.draft.mountId = payload.mountId
      this.draft.preparedSpellIds.push(...payload.preparedSpellIds)
      this.draft.combatSkillFocuses = [...payload.combatSkillFocuses]

      const { name: _name, ...quickBuild } = payload
      this.draft.creationRecord = toPlainRecord({ method: 'quick_build' as const, quickBuild })
      this.clearPendingPreview()

      await this.finalizeCharacter()
    },
    /** Character is now playable: start at full HP/Willpower, mark complete, persist. */
    async finalizeCharacter() {
      // toRaw() unwraps Pinia's reactive Proxy - structuredClone() (used inside
      // Character.Deserialize) can't clone a live reactive Proxy directly.
      const modifiers = computeStatModifiers(
        toRaw(this.draft),
        [...CoreContent.talents.narrative, ...CoreContent.talents.combat],
        CoreContent.equipment.armor,
        CoreContent.equipment.general,
      )
      const char = Character.Deserialize(toRaw(this.draft), modifiers)
      this.draft.currentHp = char.maxHp
      this.draft.currentWillpower = char.maxWillpower

      this.completedStageIds.push('finishing_touches')
      await saveCharacter(this.draft.id, toRaw(this.draft))
    },
    reset() {
      this.draft = createBaseDraft()
      this.completedStageIds = []
      this.lifepathSelections = []
      this.clearPendingPreview()
    },
  },
})
