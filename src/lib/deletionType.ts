// src/lib/deletionType.ts

export type DeletionTypeCode = 1 | 2 | 3 | 4;

/**
 * Proper's DeletionType codes. "Returns" here means stock physically going
 * back to the label (Reservoir), not a customer return.
 */
export const DELETION_TYPE_META: Record<DeletionTypeCode, { label: string; canSell: boolean; returning: boolean }> = {
  1: { label: "Can sell — not returning to label", canSell: true, returning: false },
  2: { label: "Can sell — returning to label", canSell: true, returning: true },
  3: { label: "Cannot sell — returning to label", canSell: false, returning: true },
  4: { label: "Cannot sell — not returning to label", canSell: false, returning: false },
};
