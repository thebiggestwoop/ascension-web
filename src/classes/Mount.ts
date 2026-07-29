import type { AttributeId } from './enums'

/**
 * Mounts have no stat block/HP of their own; they're controlled via a "Riding" check using
 * the mount's governing Attribute + the rider's Skirmish. Speed = baseSpeed + floor(Riding/2).
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
