export declare const THUMBNAIL_YFOV_DEG = 70;
export type PresentationCamera = {
    translation: readonly [number, number, number];
    rotation: readonly [number, number, number, number];
    znear: number;
    yfovDeg: number;
    backgroundColor?: string;
    assetId?: string;
};
/** Fallback when no per-asset `presentation.json` is available (Fire Cat). */
export declare const DEFAULT_PRESENTATION: PresentationCamera;
export declare class PresentationLoader {
    load(jsonUrl: string): Promise<PresentationCamera | null>;
    yfovToDeg(raw: Record<string, unknown>): number;
    parsePresentationCamera(raw: Record<string, unknown>): PresentationCamera | null;
}
