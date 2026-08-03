import type { AttributeId } from './enums'

/**
 * Mounts have no stat block/HP of their own; they're controlled via a "Riding" check using
 * the mount's governing Attribute alone (no Skill added). "While mounted, your Speed is
 * effectively replaced by the mount's" - see mountedSpeed() below.
 */
export interface IMountData {
  id: string
  name: string
  description: string
  ridingAttribute: AttributeId
  baseSpeed: number
  canFly: boolean
  groundImmobile?: boolean
  specialRules?: string
}

/** "A [Mount] has a Speed equal to [baseSpeed] + half your Riding (rounded down)," per Chapter
 * Seven - Riding is just the rider's value in the mount's governing Attribute. This REPLACES
 * the character's own Speed while mounted, rather than adding to it. */
export function mountedSpeed(mount: IMountData, ridingAttributeValue: number): number {
  return mount.baseSpeed + Math.floor(ridingAttributeValue / 2)
}
