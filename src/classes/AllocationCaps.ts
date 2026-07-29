/**
 * Shared cap-checking for "N points, split freely across Attributes/Skills" pickers where the
 * rules impose a ceiling that only one item may reach (e.g. "only one Attribute may be equal
 * to 11", Level Ascension's 11-then-12 ceiling). Used by both Quick Build and Level Up.
 */

/** Value `id` would have if slot `excludeSlotIndex` weren't counted - lets that slot's own
 * dropdown react to every *other* slot's pick, regardless of fill order. */
export function projectedAllocationValue<Id extends string>(
  base: Record<Id, number>,
  allocations: (Id | null)[],
  id: Id,
  excludeSlotIndex: number,
): number {
  let value = base[id]
  allocations.forEach((picked, idx) => {
    if (idx !== excludeSlotIndex && picked === id) value += 1
  })
  return value
}

/** True if picking `itemValue` for slot `slotIndex` would meet/exceed the ceiling, or would
 * be a *second* item reaching a ceiling already held by another. */
export function isAllocationDisabledByCeiling<Id extends string>(
  allIds: Id[],
  base: Record<Id, number>,
  allocations: (Id | null)[],
  itemValue: Id,
  slotIndex: number,
  ceiling: number,
): boolean {
  const projected = projectedAllocationValue(base, allocations, itemValue, slotIndex)
  if (projected >= ceiling) return true
  if (projected + 1 === ceiling) {
    return allIds.some(
      (otherId) => otherId !== itemValue && projectedAllocationValue(base, allocations, otherId, slotIndex) >= ceiling,
    )
  }
  return false
}
