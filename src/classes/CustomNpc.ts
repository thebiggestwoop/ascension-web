import { AttributeId } from './enums'
import type { SkillId } from './enums'
import type {
  INpcData,
  INpcEntry,
  INpcFormula,
  INpcStatModifiers,
  INpcTemplateData,
  NpcTier,
  Tiered,
} from './Npc'
import { computeNpcFormula, resolveTierText } from './Npc'

export type NpcBodyPart = 'head' | 'torso' | 'legs'

/**
 * A GM-built NPC from the NPC Builder: a rulebook class at one tier, plus chosen optional
 * features, an optional template, edited Attributes/Skills/Resistance, and notes. Everything
 * else (HP, Willpower, Speed, Effect Saves, attack Targets/damage) is derived from the class's
 * formulas (see INpcFormula) against the edited stats, so it's never stored.
 */
export interface ICustomNpcData {
  id: string
  name: string
  /** Id of the rulebook class it's built from (content/npcs/_index.json). */
  baseNpcId: string
  tier: NpcTier
  /** Chosen optional features, as "<section>:<name>" (section = optionalFeatures or
   * optionalMajorFeatures) - names alone aren't unique across the two lists. */
  optionalFeatureKeys: string[]
  templateId: string | null
  /** Names of the chosen template's optional features. */
  templateFeatureNames: string[]
  /** Edited Attribute values at `tier` (absent for the Colossus - see `parts`). */
  attributes?: Record<AttributeId, number>
  /** Colossus only: edited per-part Attributes. */
  parts?: Record<NpcBodyPart, Record<AttributeId, number>>
  skills: Record<SkillId, number>
  /** Base Resistance before feature modifiers (absent for the Colossus's per-part Resistance). */
  resistance?: number
  /** GM-defined tags (see the tag registry in Storage.ts), in the order they were added. */
  customTags: string[]
  notes: string
  createdAt: string
  updatedAt: string
}

export function optionalFeatureKey(section: 'optionalFeatures' | 'optionalMajorFeatures', name: string): string {
  return `${section}:${name}`
}

function atTier<K extends string>(values: Record<K, Tiered>, tier: NpcTier): Record<K, number> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, (v as Tiered)[tier - 1]])) as Record<K, number>
}

function flat<K extends string>(values: Record<K, number>): Record<K, Tiered> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, [v, v, v]])) as Record<K, Tiered>
}

/** A new Builder NPC with its class's stats at `tier`. */
export function createCustomNpc(base: INpcData, name: string, tier: NpcTier): ICustomNpcData {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name,
    baseNpcId: base.id,
    tier,
    optionalFeatureKeys: [],
    templateId: null,
    templateFeatureNames: [],
    ...seedStats(base, tier),
    customTags: [],
    notes: '',
    createdAt: now,
    updatedAt: now,
  }
}

/** The class's own Attributes/Skills/Resistance at a tier. */
export function seedStats(
  base: INpcData,
  tier: NpcTier,
): Pick<ICustomNpcData, 'attributes' | 'parts' | 'skills' | 'resistance'> {
  return {
    attributes: base.attributes ? atTier(base.attributes, tier) : undefined,
    parts: base.parts
      ? (Object.fromEntries(
          Object.entries(base.parts).map(([p, v]) => [p, atTier(v.attributes, tier)]),
        ) as Record<NpcBodyPart, Record<AttributeId, number>>)
      : undefined,
    skills: atTier(base.skills, tier),
    resistance: base.resistance,
  }
}

/** Moves a custom NPC to a new tier, keeping any edits as offsets from the class's values -
 * e.g. +1 Brawn over the Tier 1 value stays +1 over the Tier 2 value. */
export function changeTier(npc: ICustomNpcData, base: INpcData, tier: NpcTier): ICustomNpcData {
  const before = seedStats(base, npc.tier)
  const after = seedStats(base, tier)
  const shift = <K extends string>(cur: Record<K, number>, from: Record<K, number>, to: Record<K, number>) =>
    Object.fromEntries(Object.keys(to).map((k) => [k, to[k as K] + (cur[k as K] - from[k as K])])) as Record<K, number>
  return {
    ...npc,
    tier,
    attributes: npc.attributes && before.attributes && after.attributes
      ? shift(npc.attributes, before.attributes, after.attributes)
      : npc.attributes,
    parts: npc.parts && before.parts && after.parts
      ? (Object.fromEntries(
          (Object.keys(after.parts) as NpcBodyPart[]).map((p) => [p, shift(npc.parts![p], before.parts![p], after.parts![p])]),
        ) as Record<NpcBodyPart, Record<AttributeId, number>>)
      : npc.parts,
    skills: shift(npc.skills, before.skills, after.skills),
  }
}

/** Replaces each computed number in an entry's text with its value for these stats, then
 * resolves any remaining "A/B/C" tier triples. */
function resolveEntry(entry: INpcEntry, statNpc: INpcData, tier: NpcTier): INpcEntry {
  let text = entry.text
  for (const c of entry.computed ?? []) {
    const value = computeNpcFormula(statNpc, c, tier)
    text = text.replace(c.matchText, c.matchText.replace(/\d+(?:\/\d+)*/, String(value)))
  }
  const resolved: INpcEntry = { ...entry, text: resolveTierText(text, tier), computed: undefined }
  if (entry.attack) resolved.attack = resolveEntry(entry.attack, statNpc, tier)
  return resolved
}

function value(statNpc: INpcData, formula: INpcFormula | undefined, fallback: Tiered | undefined, tier: NpcTier) {
  if (formula) return computeNpcFormula(statNpc, formula, tier)
  return fallback ? fallback[tier - 1] : undefined
}

/**
 * Builds the finished stat block for a custom NPC as an INpcData whose tiered values are all
 * the same number (so it renders at any tier), with chosen optional/template features merged
 * into `features` and every derived value recomputed from the edited stats.
 */
export function resolveCustomNpc(
  npc: ICustomNpcData,
  base: INpcData,
  templates: INpcTemplateData[],
): INpcData {
  const tier = npc.tier
  // The class with its Attributes/Skills replaced by the edited values, for formula evaluation.
  const statNpc: INpcData = {
    ...base,
    attributes: npc.attributes ? flat(npc.attributes) : undefined,
    parts: npc.parts && base.parts
      ? (Object.fromEntries(
          (Object.keys(base.parts) as NpcBodyPart[]).map((p) => [p, { ...base.parts![p], attributes: flat(npc.parts![p]) }]),
        ) as INpcData['parts'])
      : base.parts,
    skills: flat(npc.skills),
  }

  const chosen: INpcEntry[] = []
  for (const section of ['optionalFeatures', 'optionalMajorFeatures'] as const) {
    for (const e of base[section] ?? []) {
      if (npc.optionalFeatureKeys.includes(optionalFeatureKey(section, e.name))) chosen.push(e)
    }
  }
  const template = templates.find((t) => t.id === npc.templateId)
  const templateEntries = template
    ? [...template.features, ...template.optionalFeatures.filter((f) => npc.templateFeatureNames.includes(f.name))]
    : []

  const mods: INpcStatModifiers[] = [...chosen, ...templateEntries].flatMap((e) => (e.statModifiers ? [e.statModifiers] : []))
  const sum = (key: keyof INpcStatModifiers) => mods.reduce((t, m) => t + ((m[key] as number | undefined) ?? 0), 0)
  const last = <K extends keyof INpcStatModifiers>(key: K) => mods.reduce<INpcStatModifiers[K]>((v, m) => m[key] ?? v, undefined)

  const derived = base.derived ?? {}
  const hpPerBar = (value(statNpc, derived.hp, base.hp, tier) ?? 0) + sum('hpPerHealthBar')
  const willpower = base.willpower ? (value(statNpc, derived.willpower, base.willpower, tier) ?? 0) + sum('willpowerBonus') : null
  const speed = (value(statNpc, derived.speed, base.speed, tier) ?? 0) + sum('speedBonus')

  let resistance: number | undefined
  if (npc.resistance !== undefined) {
    resistance = npc.resistance + sum('resistanceBonus')
    const minimum = mods.reduce((m, x) => Math.max(m, x.resistanceMinimum ?? 0), 0)
    resistance = Math.max(resistance, minimum)
  }

  let mountedSpeed = value(statNpc, derived.mountedSpeed, base.mountedSpeed, tier)
  let flyingSpeed = base.flyingSpeed?.[tier - 1]
  const flightOffset = last('flyingSpeedOffset')
  if (flightOffset !== undefined) flyingSpeed = speed + flightOffset
  for (const e of chosen) {
    if (e.statModifiers?.flying) {
      const speedFormula = e.computed?.find((c) => c.stat === 'speed')
      if (speedFormula) flyingSpeed = computeNpcFormula(statNpc, speedFormula, tier)
      if (e.statModifiers.replacesMountedSpeed) mountedSpeed = undefined
    }
  }

  const effectSaves = npc.attributes && base.effectSaves && derived.effectSaves
    ? (Object.fromEntries(
        Object.values(AttributeId).map((a) => [a, computeNpcFormula(statNpc, { ...derived.effectSaves!, attribute: a }, tier)]),
      ) as Record<AttributeId, number>)
    : undefined
  const parts = npc.parts && base.parts
    ? (Object.fromEntries(
        (Object.keys(base.parts) as NpcBodyPart[]).map((p) => [
          p,
          {
            ...base.parts![p],
            attributes: flat(npc.parts![p]),
            effectSaves: flat(
              Object.fromEntries(
                Object.values(AttributeId).map((a) => [a, Math.floor(npc.parts![p][a] / 2) - 1]),
              ) as Record<AttributeId, number>,
            ),
          },
        ]),
      ) as INpcData['parts'])
    : undefined

  const resolveAll = (list?: INpcEntry[]) => list?.map((e) => resolveEntry(e, statNpc, tier))
  const tags = [...base.tags]
  if (template) tags.push(template.name)
  if (flyingSpeed !== undefined && !tags.includes('Flying')) tags.push('Flying')
  if (mountedSpeed === undefined) {
    const i = tags.indexOf('Mounted')
    if (i >= 0) tags.splice(i, 1)
  }

  const t = (v: number): Tiered => [v, v, v]
  return {
    ...base,
    id: npc.id,
    name: npc.name,
    tags,
    attributes: npc.attributes ? flat(npc.attributes) : undefined,
    effectSaves: effectSaves ? flat(effectSaves) : undefined,
    parts,
    skills: flat(npc.skills),
    willpower: willpower === null ? null : t(willpower),
    resistance,
    hp: t(hpPerBar),
    healthBars: last('healthBars') ?? base.healthBars,
    speed: t(speed),
    mountedSpeed: mountedSpeed === undefined ? undefined : t(mountedSpeed),
    flyingSpeed: flyingSpeed === undefined ? undefined : t(flyingSpeed),
    size: last('size'),
    special: base.special ? resolveTierText(base.special, tier) : undefined,
    features: resolveAll([...(base.features ?? []), ...chosen, ...templateEntries]),
    attacks: resolveAll(base.attacks),
    groupAttacks: resolveAll(base.groupAttacks),
    divisionAttacks: resolveAll(base.divisionAttacks),
    actions: resolveAll(base.actions),
    minorActions: resolveAll(base.minorActions),
    optionalFeatures: undefined,
    optionalMajorFeatures: undefined,
    derived: undefined,
  }
}
