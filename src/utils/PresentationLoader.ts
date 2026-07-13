import { MathUtils } from 'three/webgpu'

export const THUMBNAIL_YFOV_DEG = 70

export type PresentationCamera = {
  translation: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
  znear: number;
  yfovDeg: number;
  backgroundColor?: string;
  assetId?: string;
}

/** Fallback when no per-asset `presentation.json` is available (Fire Cat). */
export const DEFAULT_PRESENTATION: PresentationCamera = {
  translation: [-0.07832128075541453, 0.5311002186330633, 2.752573139311305],
  rotation: [
    0.109143170471146, -0.01216745587399261, 0.001336077080569904, 0.9939506709364885,
  ],
  znear: 0.1,
  yfovDeg: THUMBNAIL_YFOV_DEG,
}

export class PresentationLoader {

  async load(jsonUrl: string): Promise<PresentationCamera | null> {
    try {
      const res = await fetch(jsonUrl)
      if (res.ok) {
        const parsed = this.parsePresentationCamera((await res.json()) as Record<string, unknown>)
        console.log(parsed)
        if (parsed) return parsed
      }
    } catch {
      // fall through
    }
    console.warn(`No local presentation camera for ${jsonUrl}`,)
    return null
  }

  yfovToDeg(raw: Record<string, unknown>): number {
    if (typeof raw.yfovDeg === 'number' && raw.yfovDeg > 0) return raw.yfovDeg
    const rad = typeof raw.yfov === 'number' ? raw.yfov : Number(raw.yfov)
    if (!Number.isFinite(rad) || rad <= 0) return THUMBNAIL_YFOV_DEG
    // Values > 2π are treated as degrees; otherwise radians.
    return rad > Math.PI * 2 ? rad : MathUtils.radToDeg(rad)
  }
  
  parsePresentationCamera(raw: Record<string, unknown>): PresentationCamera | null {
    // Flat presentation.json or nested { camera: { translation, rotation, perspective } }.
    const cam =
      raw.camera && typeof raw.camera === 'object'
        ? (raw.camera as Record<string, unknown>)
        : raw
    const translation = cam.translation
    const rotation = cam.rotation
    if (!Array.isArray(translation) || translation.length < 3) return null
    if (!Array.isArray(rotation) || rotation.length < 4) return null
  
    const perspective =
      cam.perspective && typeof cam.perspective === 'object'
        ? (cam.perspective as Record<string, unknown>)
        : cam
    const znearRaw = perspective.znear ?? cam.znear ?? 0.1
    const znear = typeof znearRaw === 'number' ? znearRaw : Number(znearRaw) || 0.1
  
    return {
      translation: [Number(translation[0]), Number(translation[1]), Number(translation[2])],
      rotation: [Number(rotation[0]), Number(rotation[1]), Number(rotation[2]), Number(rotation[3])],
      znear,
      yfovDeg: this.yfovToDeg({ ...perspective, yfovDeg: cam.yfovDeg ?? raw.yfovDeg }),
      backgroundColor:
        typeof raw.backgroundColor === 'string'
          ? raw.backgroundColor
          : typeof raw.defaultBackgroundColor === 'string'
            ? raw.defaultBackgroundColor
            : undefined,
      assetId: typeof raw.assetId === 'string' ? raw.assetId : undefined,
    }
  } 
}