/** Cap framebuffer resolution on high-DPR phones to reduce WebGPU memory pressure. */
export const MAX_PIXEL_RATIO = 2

export function cappedDevicePixelRatio(dpr = window.devicePixelRatio || 1) {
  return Math.min(dpr, MAX_PIXEL_RATIO)
}

type PixelRatioTarget = {
  setPixelRatio?: (value: number) => void
  renderer?: { setPixelRatio?: (value: number) => void }
  renderTarget?: { setPixelRatio?: (value: number) => void }
  onResized?: () => void
}

/**
 * Cap the shared renderer + CanvasTarget DPR, and re-apply after viewport resizes
 * (IoThreeViewport resets to window.devicePixelRatio on resize).
 */
export function installPixelRatioCap(target: PixelRatioTarget) {
  const apply = () => {
    const dpr = cappedDevicePixelRatio()
    target.setPixelRatio?.(dpr)
    target.renderer?.setPixelRatio?.(dpr)
    target.renderTarget?.setPixelRatio?.(dpr)
  }

  apply()

  if (typeof target.onResized === 'function') {
    const original = target.onResized.bind(target)
    target.onResized = () => {
      original()
      apply()
    }
  }

  return apply
}
