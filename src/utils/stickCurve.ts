export type StickVector = Readonly<{ x: number; y: number }>

export type StickCurveOptions = {
  /**
   * Width of the precise center basin on the unit disc.
   * Smaller → longer precision near center, steeper rise near the rim.
   */
  sigma?: number
  /** Peak output magnitude after the curve (applied to the unit response). */
  maxMagnitude?: number
}

const ZERO: StickVector = Object.freeze({ x: 0, y: 0 })

/**
 * Inverted radial bell on the stick disc.
 *
 * The surface is a 2D Gaussian centered at the stick origin, inverted so:
 * - center (bell peak) → magnitude ≈ 0 (precise)
 * - rim → magnitude → 1 (full throw), with a smoothstep-like rise
 *
 * Response is normalized to [0, 1] on the unit disc, then scaled by `maxMagnitude`.
 * Direction of the input vector is preserved.
 */
export function applyStickCurve(
  stick: StickVector,
  options: StickCurveOptions = {},
): StickVector {
  const sigma = options.sigma ?? 0.35
  const maxMagnitude = options.maxMagnitude ?? 1

  const x = stick.x
  const y = stick.y
  const radius = Math.hypot(x, y)
  if (radius <= 1e-6 || maxMagnitude === 0) return ZERO

  const r = Math.min(radius, 1)
  const unit = invertedBellMagnitude(r, sigma)
  const scale = (unit * maxMagnitude) / radius

  return { x: x * scale, y: y * scale }
}

/**
 * Normalized inverted Gaussian on [0, 1]:
 * 0 at center, 1 at the rim.
 */
export function invertedBellMagnitude(radius: number, sigma = 0.35): number {
  const r = Math.max(0, Math.min(1, radius))
  const s2 = 2 * sigma * sigma
  const bell = Math.exp(-(r * r) / s2)
  const bellAtRim = Math.exp(-1 / s2)
  // Invert and normalize so r=0 → 0, r=1 → 1.
  return (1 - bell) / (1 - bellAtRim)
}
