import type { SkillId } from './enums'

/** Static content definition for one of the 6 Skills, loaded from content/skills.json. */
export interface ISkillData {
  id: SkillId
  name: string
  description: string
}

/** A character's rating in one Skill. Valid range 0-5 (only one may sit at 4, one at 5). */
export interface ISkillScore {
  id: SkillId
  rating: number
}
