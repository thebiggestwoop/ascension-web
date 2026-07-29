/**
 * Every domain class that needs to round-trip through local storage or an
 * exported character file implements this. Serialization must be symmetric:
 * `Deserialize(instance.Serialize())` should produce an equivalent instance.
 */
export interface ISerializable<TData> {
  Serialize(): TData
}
