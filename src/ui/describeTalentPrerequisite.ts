import { CoreContent } from '@/io/ContentLoader'
import type { ITalentPrerequisite } from '@/classes/Talent'
import type { AttributeId, SkillId } from '@/classes/enums'

const talentNameById = new Map(
  [...CoreContent.talents.narrative, ...CoreContent.talents.combat].map((t) => [t.id, t.name]),
)

function attributeName(id: AttributeId): string {
  return CoreContent.attributes.find((a) => a.id === id)?.name ?? id
}
function skillName(id: SkillId): string {
  return CoreContent.skills.find((s) => s.id === id)?.name ?? id
}
function careerName(id: string): string {
  return CoreContent.lifepath.career.options.find((o) => o.id === id)?.name ?? id
}

/** Renders an ITalentPrerequisite as human-readable rules text, e.g. "Agility 10" or "Sword Adept". */
export function describeTalentPrerequisite(prereq: ITalentPrerequisite): string {
  const parts: string[] = []
  if (prereq.attribute) parts.push(`${attributeName(prereq.attribute.id)} ${prereq.attribute.minRating}`)
  if (prereq.attributeAny) {
    parts.push(`${prereq.attributeAny.ids.map(attributeName).join(', ')} (any) ${prereq.attributeAny.minRating}`)
  }
  if (prereq.skill) parts.push(`${skillName(prereq.skill.id)} ${prereq.skill.minRating}`)
  if (prereq.trait) parts.push(`${prereq.trait} Trait`)
  if (prereq.career) parts.push(`${careerName(prereq.career)} career`)
  if (prereq.magickDomain) parts.push(`${prereq.magickDomain[0].toUpperCase()}${prereq.magickDomain.slice(1)} Magick`)
  if (prereq.priorTalentId) parts.push(talentNameById.get(prereq.priorTalentId) ?? prereq.priorTalentId)
  if (prereq.minLevel) parts.push(`Level ${prereq.minLevel}+`)
  return parts.length ? parts.join(', ') : 'None'
}
