/**
 * Database field transformers
 * Used to transform data before saving to database
 *
 * Note: Only type-changing transforms should be here.
 * Type-preserving transforms (string → string) should stay in model setters.
 */
export const dbTransforms = {
  /**
   * Serialize object to JSON string
   */
  json: (val: unknown) => JSON.stringify(val),
}
