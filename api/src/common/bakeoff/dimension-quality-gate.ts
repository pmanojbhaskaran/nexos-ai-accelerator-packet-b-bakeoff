/** Deterministic quality gate for Packet C — not legal metrology certification. */
export type QualityDecision = 'AUTO_ACCEPT' | 'RESCAN' | 'MANUAL_FALLBACK';

export function evaluateProvisionalDimensions(input: {
  length: number;
  width: number;
  height: number;
  confidence?: number;
}): { decision: QualityDecision; qualityResult: string; billingEligible: false } {
  const { length, width, height, confidence = 0 } = input;
  if (length <= 0 || width <= 0 || height <= 0) {
    return { decision: 'MANUAL_FALLBACK', qualityResult: 'NON_POSITIVE_DIMENSION', billingEligible: false };
  }
  if (confidence >= 0.85 && length > 0 && width > 0 && height > 0) {
    return { decision: 'AUTO_ACCEPT', qualityResult: 'PROVISIONAL_OK', billingEligible: false };
  }
  if (confidence >= 0.5) {
    return { decision: 'RESCAN', qualityResult: 'LOW_CONFIDENCE', billingEligible: false };
  }
  return { decision: 'MANUAL_FALLBACK', qualityResult: 'MANUAL_REVIEW_REQUIRED', billingEligible: false };
}

/** Anti-mock: two materially different inputs must not collapse to identical dimensions. */
export function dimensionsMateriallyEqual(
  a: { length: number; width: number; height: number },
  b: { length: number; width: number; height: number },
): boolean {
  return a.length === b.length && a.width === b.width && a.height === b.height;
}
