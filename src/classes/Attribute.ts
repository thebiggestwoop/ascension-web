import type { AttributeId } from './enums'

/** Static content definition for one of the 7 Attributes, loaded from content/attributes.json. */
export interface IAttributeData {
  id: AttributeId
  name: string
  description: string
}

/** A character's rating in one Attribute. Valid range 6-12 (only one may sit at 11, one at 12). */
export interface IAttributeScore {
  id: AttributeId
  rating: number
}
