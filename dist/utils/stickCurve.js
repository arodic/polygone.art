/**
 * Bell-shaped stick sensitivity: gentle near center and at full throw,
 * strongest in the mid range for smooth acceleration.
 */
export function bellStickCurve(value) {
    const clamped = Math.max(-1, Math.min(1, value));
    const sign = Math.sign(clamped);
    const t = Math.abs(clamped);
    return sign * 4 * t * (1 - t);
}
