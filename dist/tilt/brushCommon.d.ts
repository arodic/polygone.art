import { cross, Discard, dot, exp, float, frontFacing, If, length, max, mix, modelViewMatrix, modelWorldMatrix, normalize, positionLocal, pow, select, sin, cos, texture, uv, varying, vec2, vec3, vec4, cameraViewMatrix } from 'three/tsl';
/**
 * TSL `Fn` overloads in @types/three don't model the array-arg form used here.
 * Contextual `any` keeps destructured TSL params from becoming implicit-any.
 */
type TslFn = {
    (jsFunc: (args: any) => any, layout?: string | Record<string, string>): any;
    (jsFunc: () => any, layout?: string | Record<string, string>): any;
};
declare const Fn: TslFn;
/** Legacy `{ value }` seed passed into createTiltUniformBag. */
export type UniformSeedEntry = {
    value?: any;
};
export type UniformSeed = Record<string, UniformSeedEntry | undefined>;
/** Wrapper around a TSL `uniform()` node with a legacy `.value` accessor. */
export type TiltUniformEntry<T = any> = {
    /** TSL UniformNode — used directly in shader graphs. */
    node: any;
    value: T;
};
export type TiltUniformBag = Record<string, TiltUniformEntry>;
export type LegacyUniformMap = Record<string, {
    value: any;
}>;
export type BrushMaterialProps = {
    side?: any;
    transparent?: boolean;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: any;
    toneMapped?: boolean;
    fog?: boolean;
    blendSrc?: any;
    blendDst?: any;
    blendEquation?: any;
    blendSrcAlpha?: any;
    blendDstAlpha?: any;
    blendEquationAlpha?: any;
    alphaToCoverage?: boolean;
};
export type BrushMaterialLike = {
    side: any;
    transparent: boolean;
    depthWrite: boolean;
    depthTest: boolean;
    blending: any;
    toneMapped: boolean;
    fog: boolean;
    blendSrc?: any;
    blendDst?: any;
    blendEquation?: any;
    blendSrcAlpha?: any;
    blendDstAlpha?: any;
    blendEquationAlpha?: any;
    alphaToCoverage?: boolean;
    [key: string]: any;
};
/** Brushes with NodeMaterial implementations (Fire Cat + aMGO5kSJnMY sketches). */
export declare const NODE_BRUSH_NAMES: Set<string>;
export declare function hasNodeBrush(brushName: string): boolean;
export declare function createTiltUniformBag(seed?: UniformSeed): TiltUniformBag;
/** Plain `{ value }` map for onBeforeRender compatibility. */
export declare function toLegacyUniforms(tiltUniforms: TiltUniformBag, textures?: Record<string, any>): LegacyUniformMap;
export declare const brushColor: () => import("three/webgpu").AttributeNode;
export declare const brushUv2: () => import("three/webgpu").AttributeNode;
export declare const brushUv4: () => import("three/webgpu").AttributeNode;
export declare const brushUv1Vec2: () => import("three/webgpu").AttributeNode;
export declare const brushUv1Vec3: () => import("three/webgpu").AttributeNode;
export declare const brushUv1Vec4: () => import("three/webgpu").AttributeNode;
export declare const brushUv3: () => import("three/webgpu").AttributeNode;
export declare const brushTimestamp: () => import("three/webgpu").AttributeNode;
/** Baked floor(vertexIndex / 4) for DanceFloor quad hash (replaces gl_VertexID / 4). */
export declare const brushQuadIndex: () => import("three/webgpu").AttributeNode;
export declare const brushNormalAttr: () => import("three/webgpu").AttributeNode;
export declare const brushPositionAttr: () => import("three/webgpu").AttributeNode;
export declare const brushTangentAttr: () => import("three/webgpu").AttributeNode;
/**
 * DoubleTaperedMarker / DoubleTaperedFlat stroke taper.
 * GLSL: envelope = sin(uv0.x * PI); pos = a_position - a_texcoord1 * (1 - envelope)
 */
export declare const doubleTaperedPositionLocal: any;
export declare const applyFog: any;
export declare const lambertShader: any;
export declare const shShader: any;
export declare const shShaderWithSpec: any;
/**
 * Unity SurfaceShaderSpecularGloss (Disney diffuse + optional GGX spec).
 * Icing sketch uses SpecColor=0 → diffuse-only path, which still boosts dark albedos.
 */
export declare const surfaceShaderSpecularGloss: any;
/**
 * Unity SurfaceShaderMetallicRoughness → dielectric F0 mix + SurfaceShaderInternal.
 */
export declare const surfaceShaderMetallicRoughness: any;
export declare const diffuseLighting: any;
/**
 * Surface-lit path matching Icing / OilPaint web GLSL (Disney + SH + ambient).
 */
export declare const surfaceLighting: any;
/**
 * Like surfaceLighting, but with inverted frontFacing.
 * WebGPURenderer reports WGSL front_facing inverted vs GLSL gl_FrontFacing for DoubleSide
 * stroke ribbons; use this for DoubleSide Disney brushes (Ink / Hypercolor).
 */
export declare const surfaceLightingDoubleSide: any;
/**
 * OilPaint-style helper: light bumped normal with no gl_FrontFacing lighting flip.
 * Prefer inlining PerturbNormal + this lighting in buildSurfaceBumpCutoff (no eye-dir
 * rematerialize — that zeros N·L when lights aren't camera-aligned).
 */
export declare const surfaceLightingNoFacingFlip: any;
/**
 * Tangent-space bump → view-space normal (SurfaceShaderIncludes PerturbNormal).
 */
export declare const perturbNormal: any;
/**
 * Alias of perturbNormal (OilPaint-style callers).
 */
export declare const perturbNormalDoubleSide: any;
/**
 * Same as perturbNormal but with an explicit facing flag (for debug / DoubleSide fixes).
 */
export declare const perturbNormalFacing: any;
export declare const bloomColor: any;
/**
 * Camera-facing particle quad in object space (Dots / Smoke / Embers).
 * a_position = corner, a_normal = center, a_texcoord0.z = rotation.
 *
 * Corner index comes from baked `a_corner` (= buffer index % 4), matching GLSL
 * `gl_VertexID % 4`. Cannot use WGSL `vertex_index` (draw-call order on indexed
 * meshes) or raw atlas UVs (Smoke tiles live in 0.5–1, so 1-2*uv collapses quads).
 *
 * GLSL recreateCorner signs for corner in {0,1,2,3}:
 *   fUp    = (corner==0 || corner==1) ? +1 : -1
 *   fRight = (corner==0 || corner==2) ? +1 : -1
 */
export declare const particlePositionLocal: any;
/**
 * Unity Smoke.shader curl displacement (toolkit / meter world).
 * time = _Time.x * 5; disp = curl(center * 0.1 + time) * 5 * 0.1
 */
export declare const smokeCurlDisplacement: any;
/**
 * Smoke: camera-facing particle + Unity curl-noise drift.
 */
export declare const smokeParticlePositionLocal: any;
/**
 * Bubbles preview GLSL computeDisplacement (seed in decimeters → meters).
 * jitter + curl*10, then *0.1 for web meter units.
 */
export declare const bubblesCurlDisplacement: any;
/**
 * Bubbles: camera-facing particle + scroll jitter / curl displacement.
 */
export declare const bubblesParticlePositionLocal: any;
/**
 * Rain: inflate tube along normal using radius in a_texcoord0.z (preview vertex GLSL).
 */
export declare const rainInflatePositionLocal: any;
/**
 * WaveformParticles: curl displacement from a_texcoord1 offset + lifetime (preview vertex GLSL).
 */
export declare const waveformParticlesPositionLocal: any;
/**
 * BubbleWand: bulge + curl jitter displacement (preview vertex GLSL).
 */
export declare const bubbleWandPositionLocal: any;
/**
 * HyperGrid: optional world-space vertex quantization (legacy exporter) + additive
 * unlit MainTex.a * 2×vertexColor * tint.
 * size = length(a_texcoord1.xyz); missing/zero size must not quantize (avoids NaN).
 */
export declare const hyperGridPositionLocal: any;
/**
 * Disco: pulse the ribbon along normals using stroke radius (uv0.z, or baked uv1.x).
 */
export declare const discoPositionLocal: any;
/**
 * LightWire: inflate "bulb" segments along the normal where the sine envelope is low.
 * radius from a_texcoord0.z; envelope threshold 0.15 matches preview vertex GLSL.
 */
export declare const lightWirePositionLocal: any;
/**
 * Electricity legacy path: taper ribbon + curl displacement (preview GLSL).
 * a_texcoord1 = offset from middle to edge (object space).
 */
export declare const electricityPositionLocal: any;
export declare function lightDirVaryings(u: TiltUniformBag): {
    ld0: import("three/webgpu").VaryingNode;
    ld1: import("three/webgpu").VaryingNode;
};
export declare function viewNormalVarying(): import("three/webgpu").VaryingNode;
export declare function viewTBNVaryings(): {
    vNormal: import("three/webgpu").VaryingNode;
    vTangent: import("three/webgpu").VaryingNode;
    vBitangent: import("three/webgpu").VaryingNode;
};
export declare function viewPositionVarying(positionNode?: any): import("three/webgpu").VaryingNode;
export declare function fogCoordVarying(positionNode?: any): import("three/webgpu").VaryingNode;
export declare function applyCommonMaterialProps(material: BrushMaterialLike, params?: BrushMaterialProps): BrushMaterialLike;
export declare const BLEND: {
    opaque: {
        side: 2;
        transparent: boolean;
        depthWrite: boolean;
        blending: 0;
    };
    opaqueFront: {
        side: 0;
        transparent: boolean;
        depthWrite: boolean;
        blending: 0;
    };
    additive: {
        side: 2;
        transparent: boolean;
        depthWrite: boolean;
        blending: 2;
    };
    additiveOneOne: {
        side: 2;
        transparent: boolean;
        depthWrite: boolean;
        blending: 5;
        blendSrc: 201;
        blendDst: 201;
        blendEquation: 100;
        blendSrcAlpha: 201;
        blendDstAlpha: 201;
        blendEquationAlpha: 100;
    };
    normalTransparent: {
        side: 2;
        transparent: boolean;
        depthWrite: boolean;
        blending: 1;
    };
    alphaTest: {
        side: 2;
        transparent: boolean;
        depthWrite: boolean;
        blending: 1;
    };
};
export { Discard, If, texture, uv, vec2, vec3, vec4, float, pow, exp, mix, sin, cos, length, max, normalize, dot, cross, select, frontFacing, positionLocal, modelViewMatrix, modelWorldMatrix, cameraViewMatrix, varying, Fn, };
