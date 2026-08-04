import { defineStore } from 'pinia'
import { toRaw } from 'vue'
import { AttributeId, SkillId } from '@/classes/enums'
import type { ICharacterData } from '@/classes/Character'
import { Character, computeStatModifiers } from '@/classes/Character'
import type { ILifepathSelection, ILifepathStageData } from '@/classes/Lifepath'
import { applyLifepathSelection } from '@/classes/Lifepath'
import type {
  IFinishingTouchesRecord,
  IQuickBuildRecord,
  IFocusValueTraitEntry,
  IArchetypeFinishingTouchesRecord,
} from '@/classes/CharacterHistory'
import { SPELLCASTER_TALENT_IDS } from '@/classes/Spell'
import type { IArchetypeCharacterData } from '@/classes/Archetype'
import { findArchetypeSummary } from '@/classes/Archetype'
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
    // "Every character begins each session with one point of Determination" (Chapter Three).
    determination: 1,
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
 * Start from an Archetype, Step Three ("Finishing Touches"): the Archetype's pre-filled
 * Attributes/Skills/Talents/Equipment/Spells, edited (or not) by the player. Doesn't carry
 * Focuses/Values/Traits - those were already applied to `draft` in Step Two, either via the
 * normal Lifepath stage flow (`applyStage`, unchanged) or `applyFocusValueTraitQuickEntry`
 * below - `applyArchetypeFinishingTouches` only reads back which one happened
 * (`archetypeQuickEntry` set, or not) to build an accurate creationRecord.
 */
export interface IArchetypeFinishingTouchesPayload extends IArchetypeFinishingTouchesRecord {
  name: string
  archetypeId: string
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
    /** Set once the Archetype path's "Quick Entry" Focus/Value/Trait form is submitted -
     * recorded verbatim into creationRecord.archetype at Finishing Touches. Left null when the
     * Lifepath sub-flow was used instead (that path's picks live in `lifepathSelections`, same
     * as the top-level Lifepath creation method). */
    archetypeQuickEntry: null as IFocusValueTraitEntry | null,
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
    /** Start from an Archetype, Step One: seeds the draft's Attributes/Skills with the
     * Archetype's own values as soon as it's picked, so CharacterPreview - and Step Two's
     * Lifepath sub-flow, which deliberately applies no Attribute/Skill deltas of its own - show
     * the Archetype's real starting point throughout instead of the base 6/1 draft minimums.
     * Step Three's applyArchetypeFinishingTouches later overwrites these with whatever the
     * player's final Attributes/Skills selection ends up being (identical unless they changed
     * something there), so this seeding only affects what's shown in the meantime - including
     * the "(was X)" comparison Finishing Touches' own pre-filled form triggers against it. */
    seedArchetypeAttributesSkills(archetype: IArchetypeCharacterData) {
      this.draft.attributes = { ...archetype.attributes }
      this.draft.skills = { ...archetype.skills }
    },
    /** Start from an Archetype, Step Two's "Quick Entry" option: applies Focuses/Values/Traits
     * directly, the same way applyQuickBuild's own such fields do - not a full stage, so it
     * doesn't touch completedStageIds/lifepathSelections. */
    applyFocusValueTraitQuickEntry(payload: IFocusValueTraitEntry) {
      this.draft.focuses.push(...payload.focusTexts)
      for (const text of payload.valueTexts) {
        this.draft.values.push({ text, active: true, challenged: false })
      }
      for (const name of payload.traitNames) {
        this.draft.traits.push({ name })
      }
      this.draft.traits.push({ name: `Defining Feature: ${payload.definingFeatureText}` })
      this.archetypeQuickEntry = toPlainRecord(payload)
      this.clearPendingPreview()
    },
    /** Start from an Archetype, Step Three: sets the final (editable, pre-filled) Attributes/
     * Skills/Talents/Equipment/Spells and finishes the character - Focuses/Values/Traits are
     * left untouched since Step Two already applied them (via applyStage or
     * applyFocusValueTraitQuickEntry above). */
    async applyArchetypeFinishingTouches(payload: IArchetypeFinishingTouchesPayload) {
      this.draft.name = payload.name
      this.draft.attributes = { ...payload.attributes }
      this.draft.skills = { ...payload.skills }
      // Default the Notes field to the Archetype's own playstyle tips - NotesEditor shows
      // Preview mode by default whenever it mounts with non-empty content, so this alone is
      // what makes the finished sheet open on Preview rather than Edit.
      const summary = findArchetypeSummary(CoreContent.archetypes.categories, payload.archetypeId)
      if (summary?.playstyle) this.draft.notes = summary.playstyle
      this.draft.talentIds.push(...payload.narrativeTalentIds, ...payload.combatTalentIds)
      grantSpellcasterTraitIfNeeded(this.draft, [...payload.narrativeTalentIds, ...payload.combatTalentIds])
      this.draft.equippedWeaponIds.push(...payload.equippedWeaponIds)
      if (payload.equippedArmorId) this.draft.equippedArmorId = payload.equippedArmorId
      this.draft.inventoryItemIds.push(...payload.inventoryItemIds)
      if (payload.mountId) this.draft.mountId = payload.mountId
      this.draft.preparedSpellIds.push(...payload.preparedSpellIds)
      this.draft.combatSkillFocuses = [...payload.combatSkillFocuses]

      const { name: _name, archetypeId, ...finishingTouches } = payload
      this.draft.creationRecord = toPlainRecord({
        method: 'archetype' as const,
        lifepathSelections: this.lifepathSelections.length ? this.lifepathSelections : undefined,
        archetype: {
          archetypeId,
          focusValueTraitMethod: this.archetypeQuickEntry ? ('quick_entry' as const) : ('lifepath' as const),
          quickEntry: this.archetypeQuickEntry ?? undefined,
          finishingTouches,
        },
      })
      this.clearPendingPreview()

      await this.finalizeCharacter()
    },
    async applyFinishingTouches(payload: IFinishingTouchesPayload) {
      this.draft.name = payload.name
      for (const [id, amount] of Object.entries(payload.attributeDeltas)) {
        this.draft.attributes[id as AttributeId] += amount ?? 0
      }
      for (const [id, amount] of Object.entries(payload.skillDeltas)) {
        this.draft.skills[id as SkillId] += amount ?? 0
      }
      this.draft.values.push({ text: payload.valueText, active: true, challenged: false })
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
        this.draft.values.push({ text, active: true, challenged: false })
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
      this.archetypeQuickEntry = null
      this.clearPendingPreview()
    },
  },
})
