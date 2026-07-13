export type StickVector = Readonly<{ x: number; y: number }>

export type StickCurveOptions = {
  /** Peak output magnitude after the curve (applied to the unit response). */
  maxMagnitude?: number
}

const ZERO: StickVector = Object.freeze({ x: 0, y: 0 })

/**
 * Inverted half-sphere response on the stick disc.
 *
 * Magnitude follows `1 - sqrt(1 - r²)`:
 * - flat near the center (maximum precision)
 * - full magnitude only at the rim
 *
 * Direction of the input vector is preserved; unit response is in [0, 1],
 * then scaled by `maxMagnitude`.
 */
export function applyStickCurve(
  stick: StickVector,
  options: StickCurveOptions = {},
): StickVector {
  const maxMagnitude = options.maxMagnitude ?? 1

  const x = stick.x
  const y = stick.y
  const radius = Math.hypot(x, y)
  if (radius <= 1e-6 || maxMagnitude === 0) return ZERO

  const r = Math.min(radius, 1)
  const unit = halfSphereMagnitude(r)
  const scale = (unit * maxMagnitude) / radius

  return { x: x * scale, y: y * scale }
}

/**
 * Inverted unit hemisphere on [0, 1]: 0 at center, 1 at the rim.
 * Derivative is 0 at r=0 (most precise) and rises toward the edge.
 */
export function halfSphereMagnitude(radius: number): number {
  const r = Math.max(0, Math.min(1, radius))
  return 1 - Math.sqrt(1 - r * r)
}
