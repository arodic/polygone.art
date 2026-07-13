// Copyright 2021-2026 Icosa Gallery
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { abs, attribute, clamp, cross, Discard, dot, exp, exp2, float, floor, Fn as tslFn, fract, frontFacing, If, length, max, mix, mod, modelViewMatrix, modelWorldMatrix, modelWorldMatrixInverse, highpModelNormalViewMatrix, normalize, positionLocal, pow, select, sin, cos, sqrt, ceil, texture, uniform, uv, varying, vec2, vec3, vec4, cameraViewMatrix, cameraWorldMatrix, } from 'three/tsl';
import { AdditiveBlending, CustomBlending, DoubleSide, FrontSide, Matrix4, NoBlending, NormalBlending, OneFactor, AddEquation, Vector3, Vector4, } from 'three';
const Fn = tslFn;
/** Brushes with NodeMaterial implementations (Fire Cat + aMGO5kSJnMY sketches). */
export const NODE_BRUSH_NAMES = new Set([
    'Marker',
    'TaperedMarker',
    'Highlighter',
    'SoftHighlighter',
    'Fire',
    'Light',
    'Smoke',
    'Snow',
    'DoubleTaperedMarker',
    'DoubleTaperedFlat',
    'Flat',
    'Wire',
    'TaperedFlat',
    'Dots',
    'Embers',
    'CoarseBristles',
    'UnlitHull',
    'MatteHull',
    'Spikes',
    'Icing',
    'Comet',
    'Lofted',
    'Splatter',
    'Waveform',
    'Toon',
    'HyperGrid',
    'Electricity',
    'Ink',
    'InkGeometry',
    'Rainbow',
    'Hypercolor',
    'Disco',
    'ChromaticWave',
    'OilPaint',
    'Paper',
    'ThickPaint',
    'VelvetInk',
    'Bubbles',
    'Streamers',
    'ShinyHull',
    'Stars',
    'Petal',
    'WigglyGraphite',
    'LightWire',
    'NeonPulse',
    'CelVinyl',
    'Charcoal',
    'DryBrush',
    'DuctTape',
    'DuctTapeGeometry',
    'DiamondHull',
    'WetPaint',
    'BlocksBasic',
    'BlocksGem',
    'BlocksGlass',
    'PbrTemplate',
    'PbrTransparentTemplate',
    'Taffy',
    'Leaves',
    'Leaves2',
    'Gouache',
    'Guts',
    'KeijiroTube',
    'Muscle',
    'PassthroughHull',
    'Plasma',
    'SvgTemplate',
    'TaperedWire',
    'ThickGeometry',
    'ConcaveHull',
    'SmoothHull',
    'SquarePaper',
    'SingleSided',
    'DoubleFlat',
    'TaperedMarker_Flat',
    'LeakyPen',
    'Lofted (Hue Shift)',
    'DotMarker',
    'QuillCube',
    'QuillCylinder',
    'QuillEllipse',
    'QuillRibbon',
    'Wireframe',
    'FacetedTube',
    'TubeToonInverted',
    'TaperedHueShift',
    'Feather',
    'TubeAdditive',
    'Wire (Lit)',
    '3D Printing Brush',
    'Wind',
    'Drafting',
    'Rain',
    'WaveformFFT',
    'WaveformTube',
    'WaveformParticles',
    'Space',
    'Sparks',
    'Fairy',
    'Fire2',
    'DanceFloor',
    'BubbleWand',
    'Lacewing',
    'Marbled Rainbow',
    'MylarTube',
    'Rising Bubbles',
]);
export function hasNodeBrush(brushName) {
    return NODE_BRUSH_NAMES.has(brushName);
}
function makeUniform(value) {
    const node = uniform(value);
    // Keep legacy `{ value }` and TSL node.value as one source of truth.
    return {
        node,
        get value() {
            return node.value;
        },
        set value(v) {
            node.value = v;
        },
    };
}
export function createTiltUniformBag(seed = {}) {
    const u = {};
    const ensureVec4 = (key, fallback = new Vector4()) => {
        const raw = seed[key]?.value?.clone?.() ?? seed[key]?.value ?? fallback.clone?.() ?? fallback;
        const value = raw.isVector4 || raw.isMatrix4 || raw.isVector3 ? raw : fallback;
        u[key] = makeUniform(value);
    };
    const ensureFloat = (key, fallback = 0) => {
        const value = typeof seed[key]?.value === 'number' ? seed[key].value : fallback;
        u[key] = makeUniform(value);
    };
    const ensureMat4 = (key) => {
        const value = seed[key]?.value
            ? (seed[key].value.isMatrix4 ? seed[key].value.clone() : new Matrix4().fromArray(seed[key].value))
            : new Matrix4();
        u[key] = makeUniform(value);
    };
    ensureMat4('u_SceneLight_0_matrix');
    ensureMat4('u_SceneLight_1_matrix');
    ensureVec4('u_SceneLight_0_color', new Vector4(0.778, 0.8157, 0.9914, 1));
    ensureVec4('u_SceneLight_1_color', new Vector4(0.4282, 0.4212, 0.3459, 1));
    ensureVec4('u_ambient_light_color', new Vector4(0.3922, 0.3922, 0.3922, 1));
    ensureVec4('u_time', new Vector4());
    ensureVec4('u_TintColor', new Vector4(1, 1, 1, 1));
    // fog color stored as Vector3 in legacy
    {
        const fog = seed.u_fogColor?.value?.clone?.() ?? new Vector3(0.0196, 0.0196, 0.0196);
        u.u_fogColor = makeUniform(fog);
    }
    ensureFloat('u_fogDensity', seed.u_fogDensity?.value ?? 0);
    ensureFloat('u_Cutoff', seed.u_Cutoff?.value ?? 0.067);
    ensureFloat('u_EmissionGain', seed.u_EmissionGain?.value ?? 0.5);
    ensureFloat('u_BaseGain', seed.u_BaseGain?.value ?? 0.4);
    ensureFloat('u_A2CEnabled', seed.u_A2CEnabled?.value ?? 1);
    ensureFloat('u_DitherStrength', seed.u_DitherStrength?.value ?? 0.5);
    ensureFloat('u_OrderedDither', seed.u_OrderedDither?.value ?? 0);
    ensureFloat('u_AlphaBias', seed.u_AlphaBias?.value ?? 0);
    ensureFloat('u_AlphaPower', seed.u_AlphaPower?.value ?? 1);
    ensureFloat('u_Shininess', seed.u_Shininess?.value ?? 0.15);
    ensureFloat('u_Speed', seed.u_Speed?.value ?? 1);
    ensureFloat('u_ScrollRate', seed.u_ScrollRate?.value ?? 0.6);
    ensureFloat('u_ScrollJitterIntensity', seed.u_ScrollJitterIntensity?.value ?? 0.03);
    ensureFloat('u_ScrollJitterFrequency', seed.u_ScrollJitterFrequency?.value ?? 5);
    ensureFloat('u_DisplacementIntensity', seed.u_DisplacementIntensity?.value ?? 2);
    ensureFloat('u_SparkleRate', seed.u_SparkleRate?.value ?? 5.3);
    ensureFloat('u_isNewTiltExporter', seed.u_isNewTiltExporter?.value ? 1 : 0);
    ensureFloat('u_RimIntensity', seed.u_RimIntensity?.value ?? 0.5);
    ensureFloat('u_RimPower', seed.u_RimPower?.value ?? 2);
    ensureFloat('u_Frequency', seed.u_Frequency?.value ?? 2);
    ensureFloat('u_Jitter', seed.u_Jitter?.value ?? 1);
    ensureFloat('u_Opacity', seed.u_Opacity?.value ?? 1);
    ensureFloat('u_NumSides', seed.u_NumSides?.value ?? 4);
    ensureFloat('u_Bulge', seed.u_Bulge?.value ?? 1);
    ensureFloat('u_StretchDistortionExponent', seed.u_StretchDistortionExponent?.value ?? 1);
    ensureFloat('u_Scroll1', seed.u_Scroll1?.value ?? 1);
    ensureFloat('u_Scroll2', seed.u_Scroll2?.value ?? 1);
    ensureFloat('u_FlameFadeMin', seed.u_FlameFadeMin?.value ?? 1);
    ensureFloat('u_FlameFadeMax', seed.u_FlameFadeMax?.value ?? 1);
    ensureFloat('u_Dissolve', seed.u_Dissolve?.value ?? 0);
    ensureFloat('u_MetallicFactor', seed.u_MetallicFactor?.value ?? 0);
    ensureFloat('u_RoughnessFactor', seed.u_RoughnessFactor?.value ?? 1);
    {
        const texel = seed.u_AlphaMask_TexelSize?.value?.clone?.() ??
            seed.u_AlphaMask_TexelSize?.value ??
            new Vector4(0.0156, 1, 64, 1);
        u.u_AlphaMask_TexelSize = makeUniform(texel);
    }
    {
        const scroll = seed.u_ScrollDistance?.value?.clone?.() ?? new Vector3(-0.2, 0.6, 0);
        u.u_ScrollDistance = makeUniform(scroll);
    }
    {
        const spec = seed.u_SpecColor?.value?.clone?.() ?? new Vector3(0, 0, 0);
        u.u_SpecColor = makeUniform(spec);
    }
    {
        const color = seed.u_Color?.value?.clone?.() ?? new Vector4(1, 1, 1, 1);
        u.u_Color = makeUniform(color.isVector4 ? color : new Vector4(1, 1, 1, 1));
    }
    ensureVec4('u_ColorX', new Vector4(1, 0, 0, 1));
    ensureVec4('u_ColorY', new Vector4(0, 1, 0, 1));
    ensureVec4('u_ColorZ', new Vector4(0, 0, 1, 1));
    {
        const base = seed.u_BaseColorFactor?.value?.clone?.() ??
            seed.u_BaseColorFactor?.value ??
            new Vector4(1, 1, 1, 1);
        u.u_BaseColorFactor = makeUniform(base.isVector4 ? base : new Vector4(1, 1, 1, 1));
    }
    {
        const st = seed.u_MainTex_ST?.value?.clone?.() ??
            seed.u_MainTex_ST?.value ??
            new Vector4(1, 1, 0, 0);
        u.u_MainTex_ST = makeUniform(st.isVector4 ? st : new Vector4(1, 1, 0, 0));
    }
    return u;
}
/** Plain `{ value }` map for onBeforeRender compatibility. */
export function toLegacyUniforms(tiltUniforms, textures = {}) {
    const uniforms = {};
    for (const [key, entry] of Object.entries(tiltUniforms)) {
        Object.defineProperty(uniforms, key, {
            enumerable: true,
            value: {
                get value() {
                    return entry.value;
                },
                set value(v) {
                    entry.value = v;
                },
            },
        });
    }
    for (const [key, tex] of Object.entries(textures)) {
        uniforms[key] = { value: tex };
    }
    return uniforms;
}
export const brushColor = () => attribute('a_color', 'vec4');
export const brushUv2 = () => attribute('a_texcoord0', 'vec2');
export const brushUv4 = () => attribute('a_texcoord0', 'vec4');
export const brushUv1Vec2 = () => attribute('a_texcoord1', 'vec2');
export const brushUv1Vec3 = () => attribute('a_texcoord1', 'vec3');
export const brushUv1Vec4 = () => attribute('a_texcoord1', 'vec4');
export const brushUv3 = () => attribute('a_texcoord0', 'vec3');
export const brushTimestamp = () => attribute('a_timestamp', 'float');
/** Baked floor(vertexIndex / 4) for DanceFloor quad hash (replaces gl_VertexID / 4). */
export const brushQuadIndex = () => attribute('a_quad', 'float');
export const brushNormalAttr = () => attribute('a_normal', 'vec3');
export const brushPositionAttr = () => attribute('a_position', 'vec3');
export const brushTangentAttr = () => attribute('a_tangent', 'vec4');
/**
 * DoubleTaperedMarker / DoubleTaperedFlat stroke taper.
 * GLSL: envelope = sin(uv0.x * PI); pos = a_position - a_texcoord1 * (1 - envelope)
 */
export const doubleTaperedPositionLocal = Fn(() => {
    const pos = brushPositionAttr();
    const uv0 = brushUv2();
    const offset = brushUv1Vec3();
    const envelope = sin(uv0.x.mul(3.14159));
    const widthMultiplier = float(1).sub(envelope);
    return pos.sub(offset.mul(widthMultiplier));
});
export const applyFog = Fn(([color, fogCoord, fogColor, fogDensity]) => {
    const density = fogDensity.div(0.693147).mul(10.0);
    const fogFactor = clamp(exp2(abs(fogCoord).mul(density).negate()), float(0), float(1));
    return mix(fogColor, color, fogFactor);
});
export const lambertShader = Fn(([normal, lightDir, lightColor, diffuseColor]) => {
    const NdotL = clamp(dot(normal, lightDir), float(0), float(1));
    return diffuseColor.mul(lightColor).mul(NdotL);
});
export const shShader = Fn(([normal, lightDir, lightColor, diffuseColor]) => {
    const NdotL = clamp(dot(normal, lightDir), float(0), float(1));
    return diffuseColor.mul(lightColor).mul(NdotL);
});
export const shShaderWithSpec = Fn(([normal, lightDir, lightColor, diffuseColor, specularColor]) => {
    const specularGrayscale = dot(specularColor, vec3(0.3, 0.59, 0.11));
    const NdotL = clamp(dot(normal, lightDir), float(0), float(1));
    const shMul = float(1).sub(specularGrayscale);
    return diffuseColor.mul(lightColor).mul(NdotL).mul(shMul).mul(shMul);
});
const pow5 = Fn(([x]) => {
    const x2 = x.mul(x);
    return x2.mul(x2).mul(x);
});
const disneyDiffuseTerm = Fn(([NdotV, NdotL, LdotH, perceptualRoughness]) => {
    const fd90 = float(0.5).add(float(2).mul(LdotH).mul(LdotH).mul(perceptualRoughness));
    const lightScatter = float(1).add(fd90.sub(1).mul(pow5(float(1).sub(NdotL))));
    const viewScatter = float(1).add(fd90.sub(1).mul(pow5(float(1).sub(NdotV))));
    return lightScatter.mul(viewScatter);
});
/**
 * Unity SurfaceShaderSpecularGloss (Disney diffuse + optional GGX spec).
 * Icing sketch uses SpecColor=0 → diffuse-only path, which still boosts dark albedos.
 */
export const surfaceShaderSpecularGloss = Fn(([normal, lightDir, eyeDir, lightColor, albedoColor, specularColor, gloss,]) => {
    const oneMinusSpecularIntensity = float(1).sub(clamp(max(max(specularColor.x, specularColor.y), specularColor.z), float(0), float(1)));
    const diffuseColor = albedoColor.mul(oneMinusSpecularIntensity);
    const perceptualRoughness = float(1).sub(gloss);
    const NdotL = clamp(dot(normal, lightDir), float(0), float(1));
    const NdotV = abs(dot(normal, eyeDir));
    const halfVector = normalize(lightDir.add(eyeDir));
    const NdotH = clamp(dot(normal, halfVector), float(0), float(1));
    const LdotH = clamp(dot(lightDir, halfVector), float(0), float(1));
    const diffuseTerm = NdotL.mul(disneyDiffuseTerm(NdotV, NdotL, LdotH, perceptualRoughness));
    const diffuseOnly = diffuseColor.mul(lightColor.mul(diffuseTerm));
    // Specular path (skipped when SpecColor ~ 0)
    const roughness = perceptualRoughness.mul(perceptualRoughness);
    const a2 = roughness.mul(roughness);
    const d = NdotH.mul(a2.sub(NdotH)).mul(NdotH).add(1.0);
    const D = float(0.318309886).mul(a2).div(d.mul(d).add(1e-7));
    const lambdaV = NdotL.mul(mix(NdotV, float(1), roughness));
    const lambdaL = NdotV.mul(mix(NdotL, float(1), roughness));
    const V = float(0.5).div(lambdaV.add(lambdaL).add(1e-5));
    let specularTerm = V.mul(D).mul(3.141592654);
    specularTerm = sqrt(max(float(1e-4), specularTerm)).mul(NdotL);
    const fresnelT = pow5(float(1).sub(LdotH));
    const fresnelColor = specularColor.add(vec3(1, 1, 1).sub(specularColor).mul(fresnelT));
    const withSpec = lightColor.mul(diffuseColor.mul(diffuseTerm).add(fresnelColor.mul(specularTerm)));
    return select(length(specularColor).lessThan(1e-5), diffuseOnly, withSpec);
});
/**
 * Unity SurfaceShaderMetallicRoughness → dielectric F0 mix + SurfaceShaderInternal.
 */
export const surfaceShaderMetallicRoughness = Fn(([normal, lightDir, eyeDir, lightColor, albedoColor, metallic, perceptualRoughness,]) => {
    const dielectric = vec3(0.220916301, 0.220916301, 0.220916301);
    const oneMinusDielectric = float(1).sub(0.220916301);
    const specularColor = mix(dielectric, albedoColor, metallic);
    const diffuseColor = albedoColor.mul(oneMinusDielectric.mul(float(1).sub(metallic)));
    const NdotL = clamp(dot(normal, lightDir), float(0), float(1));
    const NdotV = abs(dot(normal, eyeDir));
    const halfVector = normalize(lightDir.add(eyeDir));
    const NdotH = clamp(dot(normal, halfVector), float(0), float(1));
    const LdotH = clamp(dot(lightDir, halfVector), float(0), float(1));
    const diffuseTerm = NdotL.mul(disneyDiffuseTerm(NdotV, NdotL, LdotH, perceptualRoughness));
    const roughness = perceptualRoughness.mul(perceptualRoughness);
    const a2 = roughness.mul(roughness);
    const d = NdotH.mul(a2.sub(NdotH)).mul(NdotH).add(1.0);
    const D = float(0.318309886).mul(a2).div(d.mul(d).add(1e-7));
    const lambdaV = NdotL.mul(mix(NdotV, float(1), roughness));
    const lambdaL = NdotV.mul(mix(NdotL, float(1), roughness));
    const V = float(0.5).div(lambdaV.add(lambdaL).add(1e-5));
    let specularTerm = V.mul(D).mul(3.141592654);
    specularTerm = sqrt(max(float(1e-4), specularTerm)).mul(NdotL);
    const fresnelT = pow5(float(1).sub(LdotH));
    const fresnelColor = specularColor.add(vec3(1, 1, 1).sub(specularColor).mul(fresnelT));
    return lightColor.mul(diffuseColor.mul(diffuseTerm).add(fresnelColor.mul(specularTerm)));
});
export const diffuseLighting = Fn(([normal, lightDir0, lightDir1, lightColor0, lightColor1, ambientColor, vertexRgb,]) => {
    const n = normalize(normal);
    const nFacing = select(frontFacing, n, n.negate());
    const lightOut0 = lambertShader(nFacing, normalize(lightDir0), lightColor0, vertexRgb);
    const lightOut1 = shShader(nFacing, normalize(lightDir1), lightColor1, vertexRgb);
    const ambientOut = vertexRgb.mul(ambientColor);
    return lightOut0.add(lightOut1).add(ambientOut);
});
/**
 * Surface-lit path matching Icing / OilPaint web GLSL (Disney + SH + ambient).
 */
export const surfaceLighting = Fn(([normal, lightDir0, lightDir1, eyeDir, lightColor0, lightColor1, ambientColor, vertexRgb, specColor, shininess,]) => {
    const n = normalize(normal);
    // Match GLSL computeLighting: flip after PerturbNormal (which may already have flipped).
    const nFacing = select(frontFacing, n, n.negate());
    const ld0 = normalize(lightDir0);
    const ld1 = normalize(lightDir1);
    const ed = normalize(eyeDir);
    const lightOut0 = surfaceShaderSpecularGloss(nFacing, ld0, ed, lightColor0, vertexRgb, specColor, shininess);
    const lightOut1 = shShaderWithSpec(nFacing, ld1, lightColor1, vertexRgb, specColor);
    const ambientOut = vertexRgb.mul(ambientColor);
    return lightOut0.add(lightOut1).add(ambientOut);
});
/**
 * Like surfaceLighting, but with inverted frontFacing.
 * WebGPURenderer reports WGSL front_facing inverted vs GLSL gl_FrontFacing for DoubleSide
 * stroke ribbons; use this for DoubleSide Disney brushes (Ink / Hypercolor).
 */
export const surfaceLightingDoubleSide = Fn(([normal, lightDir0, lightDir1, eyeDir, lightColor0, lightColor1, ambientColor, vertexRgb, specColor, shininess,]) => {
    const n = normalize(normal);
    const nFacing = select(frontFacing, n.negate(), n);
    const ld0 = normalize(lightDir0);
    const ld1 = normalize(lightDir1);
    const ed = normalize(eyeDir);
    const lightOut0 = surfaceShaderSpecularGloss(nFacing, ld0, ed, lightColor0, vertexRgb, specColor, shininess);
    const lightOut1 = shShaderWithSpec(nFacing, ld1, lightColor1, vertexRgb, specColor);
    const ambientOut = vertexRgb.mul(ambientColor);
    return lightOut0.add(lightOut1).add(ambientOut);
});
/**
 * OilPaint-style helper: light bumped normal with no gl_FrontFacing lighting flip.
 * Prefer inlining PerturbNormal + this lighting in buildSurfaceBumpCutoff (no eye-dir
 * rematerialize — that zeros N·L when lights aren't camera-aligned).
 */
export const surfaceLightingNoFacingFlip = Fn(([normal, lightDir0, lightDir1, eyeDir, lightColor0, lightColor1, ambientColor, vertexRgb, specColor, shininess,]) => {
    const n = normalize(normal);
    const ed = normalize(eyeDir);
    const ld0 = normalize(lightDir0);
    const ld1 = normalize(lightDir1);
    const lightOut0 = surfaceShaderSpecularGloss(n, ld0, ed, lightColor0, vertexRgb, specColor, shininess);
    const lightOut1 = shShaderWithSpec(n, ld1, lightColor1, vertexRgb, specColor);
    const ambientOut = vertexRgb.mul(ambientColor);
    return lightOut0.add(lightOut1).add(ambientOut);
});
/**
 * Tangent-space bump → view-space normal (SurfaceShaderIncludes PerturbNormal).
 */
export const perturbNormal = Fn(([tangent, bitangent, normal, uvNode, bumpMap]) => {
    return perturbNormalFacing(tangent, bitangent, normal, uvNode, bumpMap, frontFacing);
});
/**
 * Alias of perturbNormal (OilPaint-style callers).
 */
export const perturbNormalDoubleSide = Fn(([tangent, bitangent, normal, uvNode, bumpMap]) => {
    return perturbNormalFacing(tangent, bitangent, normal, uvNode, bumpMap, frontFacing);
});
/**
 * Same as perturbNormal but with an explicit facing flag (for debug / DoubleSide fixes).
 */
export const perturbNormalFacing = Fn(([tangent, bitangent, normal, uvNode, bumpMap, facing]) => {
    const n = select(facing, normal, normal.negate());
    const t = select(facing, tangent, tangent.negate());
    const b = select(facing, bitangent, bitangent.negate());
    const sample = texture(bumpMap, uvNode).xyz;
    const zRebuilt = sqrt(float(1).sub(clamp(dot(sample.xy, sample.xy), float(0), float(1))));
    const z = select(abs(sample.z).lessThan(0.1), zRebuilt, sample.z);
    const packed = vec3(sample.x, sample.y, z);
    const tangentNormal = packed.mul(2).sub(1);
    // flipY=false texture load → invert Y in tangent space
    const tn = vec3(tangentNormal.x, tangentNormal.y.negate(), tangentNormal.z);
    return normalize(t.mul(tn.x).add(b.mul(tn.y)).add(n.mul(tn.z)));
});
export const bloomColor = Fn(([color, gain]) => {
    const cmin = length(color.rgb).mul(0.05);
    const rgb = max(color.rgb, vec3(cmin, cmin, cmin));
    const r = pow(rgb.x, float(2.2));
    const g = pow(rgb.y, float(2.2));
    const b = pow(rgb.z, float(2.2));
    const a = pow(color.a, float(2.2));
    const boosted = vec3(r, g, b).mul(float(2).mul(exp(gain.mul(10))));
    return vec4(boosted, a);
});
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
export const particlePositionLocal = Fn(() => {
    const vertexPos = attribute('a_position', 'vec3');
    const center = attribute('a_normal', 'vec3');
    const texcoord0 = attribute('a_texcoord0', 'vec4');
    const corner = attribute('a_corner', 'float');
    const rotation = texcoord0.z;
    const size = length(vertexPos.sub(center)).mul(0.70710678);
    const scale = modelWorldMatrix.element(float(1)).element(float(1));
    const sized = size.mul(scale);
    const c = cos(rotation);
    const s = sin(rotation);
    const up = vec3(s, c, float(0));
    const right = vec3(c, s.negate(), float(0));
    // corner 0,1 → +up; 2,3 → -up. corner even → +right; odd → -right.
    const fUp = select(corner.lessThan(1.5), float(1), float(-1));
    const fRight = select(mod(corner, float(2)).lessThan(0.5), float(1), float(-1));
    const centerView = modelViewMatrix.mul(vec4(center, 1)).xyz;
    const displaced = centerView
        .add(right.mul(fRight).mul(sized))
        .add(up.mul(fUp).mul(sized));
    // WGSL has no matrix inverse(); inverse(MV) == modelWorldMatrixInverse * cameraWorldMatrix.
    return modelWorldMatrixInverse.mul(cameraWorldMatrix).mul(vec4(displaced, 1)).xyz;
});
// --- Curl noise (Unity Noise.cginc / Bubbles / Electricity web ports) ---
const mod289_v2 = Fn(([x]) => x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0)));
const mod289_v3 = Fn(([x]) => x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0)));
const permute_v3 = Fn(([x]) => mod289_v3(x.mul(34.0).add(1.0).mul(x)));
const snoise2D = Fn(([v]) => {
    const C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    const i = floor(v.add(dot(v, C.yy)));
    const x0 = v.sub(i).add(dot(i, C.xx));
    const i1 = select(x0.x.greaterThan(x0.y), vec2(1.0, 0.0), vec2(0.0, 1.0));
    const x12 = x0.xyxy.add(C.xxzz);
    const x12xy = x12.xy.sub(i1);
    const ii = mod289_v2(i);
    const p = permute_v3(permute_v3(ii.y.add(vec3(0.0, i1.y, 1.0))).add(ii.x.add(vec3(0.0, i1.x, 1.0))));
    const m0 = max(float(0.5).sub(vec3(dot(x0, x0), dot(x12xy, x12xy), dot(x12.zw, x12.zw))), float(0));
    const m = m0.mul(m0).mul(m0.mul(m0));
    const x = fract(p.mul(C.www)).mul(2.0).sub(1.0);
    const h = abs(x).sub(0.5);
    const ox = floor(x.add(0.5));
    const a0 = x.sub(ox);
    const m2 = m.mul(float(1.79284291400159).sub(float(0.85373472095314).mul(a0.mul(a0).add(h.mul(h)))));
    const g = vec3(a0.x.mul(x0.x).add(h.x.mul(x0.y)), a0.y.mul(x12xy.x).add(h.y.mul(x12xy.y)), a0.z.mul(x12.z).add(h.z.mul(x12.w)));
    return float(130.0).mul(dot(m2, g));
});
const snoise3D = Fn(([v]) => vec3(snoise2D(vec2(v.x, v.y)), snoise2D(vec2(v.y, v.z)), snoise2D(vec2(v.z, v.x))));
const curlX = Fn(([v, d]) => {
    const a = snoise3D(vec3(v.x, v.y.add(d), v.z)).z.sub(snoise3D(vec3(v.x, v.y.sub(d), v.z)).z);
    const b = snoise3D(vec3(v.x, v.y, v.z.add(d))).y.sub(snoise3D(vec3(v.x, v.y, v.z.sub(d))).y);
    return a.sub(b).div(d.mul(2.0));
});
const curlY = Fn(([v, d]) => {
    const a = snoise3D(vec3(v.x, v.y, v.z.add(d))).x.sub(snoise3D(vec3(v.x, v.y, v.z.sub(d))).x);
    const b = snoise3D(vec3(v.x.add(d), v.y, v.z)).z.sub(snoise3D(vec3(v.x.sub(d), v.y, v.z)).z);
    return a.sub(b).div(d.mul(2.0));
});
const curlZ = Fn(([v, d]) => {
    const a = snoise3D(vec3(v.x.add(d), v.y, v.z)).y.sub(snoise3D(vec3(v.x.sub(d), v.y, v.z)).y);
    const b = snoise3D(vec3(v.x, v.y.add(d), v.z)).x.sub(snoise3D(vec3(v.x, v.y.sub(d), v.z)).x);
    return a.sub(b).div(d.mul(2.0));
});
/**
 * Unity Smoke.shader curl displacement (toolkit / meter world).
 * time = _Time.x * 5; disp = curl(center * 0.1 + time) * 5 * 0.1
 */
export const smokeCurlDisplacement = Fn(([worldCenter, timeVec]) => {
    const time = timeVec.x.mul(5.0);
    const d = float(30.0);
    const freq = float(0.1);
    const p = worldCenter.mul(freq).add(time);
    const disp = vec3(curlX(p, d), curlY(p, d), curlZ(p, d));
    // kDecimetersToWorldUnits = 0.1 in toolkit builds
    return disp.mul(5.0).mul(0.1);
});
/**
 * Smoke: camera-facing particle + Unity curl-noise drift.
 */
export const smokeParticlePositionLocal = Fn(([timeVec]) => {
    const base = particlePositionLocal();
    const center = attribute('a_normal', 'vec3');
    const worldCenter = modelWorldMatrix.mul(vec4(center, 1)).xyz;
    const disp = smokeCurlDisplacement(worldCenter, timeVec);
    const worldPos = modelWorldMatrix.mul(vec4(base, 1)).xyz.add(disp);
    return modelWorldMatrixInverse.mul(vec4(worldPos, 1)).xyz;
});
/**
 * Bubbles preview GLSL computeDisplacement (seed in decimeters → meters).
 * jitter + curl*10, then *0.1 for web meter units.
 */
export const bubblesCurlDisplacement = Fn(([worldCenter, timeVec, scrollRate, jitterIntensity, jitterFrequency]) => {
    const seed = worldCenter.mul(10.0);
    const t = timeVec.y.mul(scrollRate).add(1.0);
    const jitter = vec3(sin(t.add(timeVec.y).add(seed.z.mul(jitterFrequency))), cos(t.mul(1.2).add(timeVec.y).add(seed.x.mul(jitterFrequency))), cos(t.add(timeVec.y).add(seed.x.mul(jitterFrequency)))).mul(jitterIntensity);
    const v = seed.add(jitter).mul(0.1).add(timeVec.x.mul(5.0));
    const d = float(30.0);
    const curl = vec3(curlX(v, d), curlY(v, d), curlZ(v, d)).mul(10.0);
    return jitter.add(curl).mul(0.1);
});
/**
 * Bubbles: camera-facing particle + scroll jitter / curl displacement.
 */
export const bubblesParticlePositionLocal = Fn(([timeVec, scrollRate, jitterIntensity, jitterFrequency]) => {
    const base = particlePositionLocal();
    const center = attribute('a_normal', 'vec3');
    const worldCenter = modelWorldMatrix.mul(vec4(center, 1)).xyz;
    const disp = bubblesCurlDisplacement(worldCenter, timeVec, scrollRate, jitterIntensity, jitterFrequency);
    const worldPos = modelWorldMatrix.mul(vec4(base, 1)).xyz.add(disp);
    return modelWorldMatrixInverse.mul(vec4(worldPos, 1)).xyz;
});
/**
 * Rain: inflate tube along normal using radius in a_texcoord0.z (preview vertex GLSL).
 */
export const rainInflatePositionLocal = Fn(() => {
    const pos = brushPositionAttr();
    const uv0 = brushUv3();
    const radius = uv0.z;
    return pos.add(brushNormalAttr().mul(float(1.5).mul(radius)));
});
const waveformHash3 = Fn(([p]) => {
    const d0 = dot(p, vec3(127.1, 311.7, 74.7));
    const d1 = dot(p, vec3(269.5, 183.3, 246.1));
    const d2 = dot(p, vec3(113.5, 271.9, 124.6));
    return fract(sin(vec3(d0, d1, d2)).mul(43758.5453123));
});
const waveformNoise3 = Fn(([p]) => {
    const i = floor(p);
    const f = fract(p);
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    const n000 = dot(waveformHash3(i.add(vec3(0, 0, 0))), f.sub(vec3(0, 0, 0)));
    const n100 = dot(waveformHash3(i.add(vec3(1, 0, 0))), f.sub(vec3(1, 0, 0)));
    const n010 = dot(waveformHash3(i.add(vec3(0, 1, 0))), f.sub(vec3(0, 1, 0)));
    const n110 = dot(waveformHash3(i.add(vec3(1, 1, 0))), f.sub(vec3(1, 1, 0)));
    const n001 = dot(waveformHash3(i.add(vec3(0, 0, 1))), f.sub(vec3(0, 0, 1)));
    const n101 = dot(waveformHash3(i.add(vec3(1, 0, 1))), f.sub(vec3(1, 0, 1)));
    const n011 = dot(waveformHash3(i.add(vec3(0, 1, 1))), f.sub(vec3(0, 1, 1)));
    const n111 = dot(waveformHash3(i.add(vec3(1, 1, 1))), f.sub(vec3(1, 1, 1)));
    const nx00 = mix(n000, n100, u.x);
    const nx10 = mix(n010, n110, u.x);
    const nx01 = mix(n001, n101, u.x);
    const nx11 = mix(n011, n111, u.x);
    const nxy0 = mix(nx00, nx10, u.y);
    const nxy1 = mix(nx01, nx11, u.y);
    return mix(nxy0, nxy1, u.z);
});
const waveformCurlX = Fn(([p, d]) => {
    const y1 = waveformNoise3(p.add(vec3(0, d, 0)));
    const y2 = waveformNoise3(p.sub(vec3(0, d, 0)));
    const z1 = waveformNoise3(p.add(vec3(0, 0, d)));
    const z2 = waveformNoise3(p.sub(vec3(0, 0, d)));
    return y1.sub(y2).sub(z1.sub(z2)).div(d.mul(2));
});
const waveformCurlY = Fn(([p, d]) => {
    const z1 = waveformNoise3(p.add(vec3(0, 0, d)));
    const z2 = waveformNoise3(p.sub(vec3(0, 0, d)));
    const x1 = waveformNoise3(p.add(vec3(d, 0, 0)));
    const x2 = waveformNoise3(p.sub(vec3(d, 0, 0)));
    return z1.sub(z2).sub(x1.sub(x2)).div(d.mul(2));
});
const waveformCurlZ = Fn(([p, d]) => {
    const x1 = waveformNoise3(p.add(vec3(d, 0, 0)));
    const x2 = waveformNoise3(p.sub(vec3(d, 0, 0)));
    const y1 = waveformNoise3(p.add(vec3(0, d, 0)));
    const y2 = waveformNoise3(p.sub(vec3(0, d, 0)));
    return x1.sub(x2).sub(y1.sub(y2)).div(d.mul(2));
});
/**
 * WaveformParticles: curl displacement from a_texcoord1 offset + lifetime (preview vertex GLSL).
 */
export const waveformParticlesPositionLocal = Fn(([timeVec]) => {
    const pos = brushPositionAttr();
    const offset = brushUv1Vec4().xyz;
    const lifetimeW = brushUv1Vec4().w;
    const aColor = brushColor();
    const lifetime = timeVec.y.sub(lifetimeW);
    const release = clamp(lifetime.mul(0.1), float(0), float(1));
    const midpoint = pos.sub(offset);
    const d = float(10).add(aColor.y.mul(3));
    const freq = float(1.5).add(aColor.x);
    const p = midpoint.mul(freq).add(vec3(lifetime, lifetime, lifetime));
    const disp = vec3(waveformCurlX(p, d), waveformCurlY(p, d), waveformCurlZ(p, d));
    const displacedMid = midpoint.add(release.mul(disp).mul(10));
    return displacedMid.add(offset);
});
/**
 * BubbleWand: bulge + curl jitter displacement (preview vertex GLSL).
 */
export const bubbleWandPositionLocal = Fn(([timeVec, scrollRate, jitterIntensity, jitterFrequency, isNewExporter]) => {
    const pos = brushPositionAttr();
    const uv0 = brushUv3();
    const bakedRadius = brushUv1Vec3().x;
    const useBaked = isNewExporter.greaterThan(0.5);
    const radius = select(useBaked, select(bakedRadius.greaterThan(1e-6), bakedRadius, uv0.z), uv0.z);
    const wave = sin(uv0.x.mul(3.14159));
    const waveDisp = brushNormalAttr().mul(radius).mul(wave);
    let vertex = pos.add(waveDisp);
    const t = timeVec.y.mul(scrollRate);
    const jitterX = sin(t.add(timeVec.y).add(vertex.z.mul(jitterFrequency))).mul(jitterIntensity);
    const jitterZ = cos(t.add(timeVec.y).add(vertex.x.mul(jitterFrequency))).mul(jitterIntensity);
    const jitterY = cos(t.mul(1.2).add(timeVec.y).add(vertex.x.mul(jitterFrequency))).mul(jitterIntensity);
    vertex = vertex.add(vec3(jitterX, jitterY, jitterZ));
    const d = float(30);
    const freq = float(0.1);
    const curlP = vertex.mul(freq).add(vec3(timeVec.x, timeVec.x, timeVec.x));
    const curl = vec3(curlX(curlP, d), curlY(curlP, d), curlZ(curlP, d)).mul(jitterIntensity);
    return vertex.add(curl);
});
/**
 * HyperGrid: optional world-space vertex quantization (legacy exporter) + additive
 * unlit MainTex.a * 2×vertexColor * tint.
 * size = length(a_texcoord1.xyz); missing/zero size must not quantize (avoids NaN).
 */
export const hyperGridPositionLocal = Fn(([isNewExporter]) => {
    const pos = brushPositionAttr();
    const size = length(brushUv1Vec3());
    const worldPos = modelWorldMatrix.mul(vec4(pos, 1)).xyz;
    const q = float(1).div(max(size, float(1e-6))).mul(0.5);
    const quantized = ceil(worldPos.mul(q)).div(q);
    const outWorld = select(isNewExporter.lessThan(0.5), select(size.greaterThan(1e-6), quantized, worldPos), worldPos);
    return modelWorldMatrixInverse.mul(vec4(outWorld, 1)).xyz;
});
/**
 * Disco: pulse the ribbon along normals using stroke radius (uv0.z, or baked uv1.x).
 */
export const discoPositionLocal = Fn(([timeVec, isNewExporter]) => {
    const pos = brushPositionAttr();
    const uv0 = brushUv4();
    const bakedRadius = brushUv1Vec3().x;
    const useBaked = isNewExporter.greaterThan(0.5);
    const radius = select(useBaked, select(bakedRadius.greaterThan(1e-6), bakedRadius, uv0.z), uv0.z);
    const t = timeVec.z;
    const theta = mod(uv0.y, float(1));
    // 1 - (sin(...) + 1) == -sin(...); then squared → sin²
    const pulse = float(1).sub(sin(t.add(uv0.x.mul(10)).add(theta.mul(10))).add(1));
    const pulseSq = pulse.mul(pulse);
    return pos.add(brushNormalAttr().mul(pulseSq).mul(0.6).mul(radius));
});
/**
 * LightWire: inflate "bulb" segments along the normal where the sine envelope is low.
 * radius from a_texcoord0.z; envelope threshold 0.15 matches preview vertex GLSL.
 */
export const lightWirePositionLocal = Fn(() => {
    const pos = brushPositionAttr();
    const uv0 = brushUv4();
    const envelope = sin(mod(uv0.x.mul(2), float(1)).mul(3.14159));
    const lights = select(envelope.lessThan(0.15), float(1), float(0));
    const radius = uv0.z.mul(0.9);
    return pos.add(brushNormalAttr().mul(lights).mul(radius));
});
/**
 * Electricity legacy path: taper ribbon + curl displacement (preview GLSL).
 * a_texcoord1 = offset from middle to edge (object space).
 */
export const electricityPositionLocal = Fn(([timeVec, displacementIntensity]) => {
    const pos = brushPositionAttr();
    const uv0 = brushUv2();
    const offset = brushUv1Vec3();
    const envelope = sin(uv0.x.mul(3.14159));
    const envelopePow = float(1).sub(pow(float(1).sub(envelope), float(10)));
    const widthiness = length(offset).div(0.02);
    const midpoint = pos.sub(offset);
    const tapered = midpoint.add(offset.mul(envelopePow));
    const time = timeVec.w;
    const modAmt = float(1);
    const d1 = float(30);
    const freq1 = float(0.1).add(modAmt);
    const p1 = midpoint.div(max(widthiness, float(1e-6))).mul(freq1).add(time);
    const disp1 = vec3(curlX(p1, d1), curlY(p1, d1), curlZ(p1, d1)).mul(3);
    const time2 = time.mul(1.777);
    const d2 = float(100);
    const freq2 = float(0.2).add(modAmt);
    const p2 = midpoint.div(max(widthiness, float(1e-6))).mul(freq2).add(time2);
    const disp2 = vec3(curlX(p2, d2), curlY(p2, d2), curlZ(p2, d2)).mul(7);
    const disp = disp1.add(disp2);
    const displaced = tapered.add(widthiness.mul(disp).mul(displacementIntensity).mul(envelopePow));
    const useDisp = widthiness.greaterThan(0);
    const objectPos = select(useDisp, displaced, tapered);
    return objectPos;
});
export function lightDirVaryings(u) {
    // mat3(matrix) * vec3(0,0,1) == third column of the upper 3x3
    const ld0 = varying(u.u_SceneLight_0_matrix.node.mul(vec4(0, 0, 1, 0)).xyz, 'v_tb_light0');
    const ld1 = varying(u.u_SceneLight_1_matrix.node.mul(vec4(0, 0, 1, 0)).xyz, 'v_tb_light1');
    return { ld0, ld1 };
}
export function viewNormalVarying() {
    // Match RawShaderMaterial `normalMatrix` (model-view), not world `modelNormalMatrix`.
    return varying(normalize(highpModelNormalViewMatrix.mul(brushNormalAttr())), 'v_tb_normal');
}
export function viewTBNVaryings() {
    const n = normalize(highpModelNormalViewMatrix.mul(brushNormalAttr()));
    const tangentAttr = brushTangentAttr();
    const t = normalize(highpModelNormalViewMatrix.mul(tangentAttr.xyz));
    const b = cross(n, t).mul(tangentAttr.w);
    return {
        vNormal: varying(n, 'v_tb_normal'),
        vTangent: varying(t, 'v_tb_tangent'),
        vBitangent: varying(b, 'v_tb_bitangent'),
    };
}
export function viewPositionVarying(positionNode = positionLocal) {
    return varying(modelViewMatrix.mul(vec4(positionNode, 1)).xyz, 'v_tb_viewpos');
}
export function fogCoordVarying(positionNode = positionLocal) {
    const viewPos = modelViewMatrix.mul(vec4(positionNode, 1));
    return varying(viewPos.z, 'f_fog_coord');
}
export function applyCommonMaterialProps(material, params = {}) {
    material.side = params.side ?? DoubleSide;
    material.transparent = params.transparent ?? false;
    material.depthWrite = params.depthWrite ?? true;
    material.depthTest = params.depthTest ?? true;
    material.blending = params.blending ?? NoBlending;
    material.toneMapped = false;
    material.fog = false; // TB fog is custom
    if (params.blendSrc !== undefined)
        material.blendSrc = params.blendSrc;
    if (params.blendDst !== undefined)
        material.blendDst = params.blendDst;
    if (params.blendEquation !== undefined)
        material.blendEquation = params.blendEquation;
    if (params.blendSrcAlpha !== undefined)
        material.blendSrcAlpha = params.blendSrcAlpha;
    if (params.blendDstAlpha !== undefined)
        material.blendDstAlpha = params.blendDstAlpha;
    if (params.blendEquationAlpha !== undefined)
        material.blendEquationAlpha = params.blendEquationAlpha;
    if (params.alphaToCoverage !== undefined)
        material.alphaToCoverage = params.alphaToCoverage;
    return material;
}
export const BLEND = {
    opaque: { side: DoubleSide, transparent: false, depthWrite: true, blending: NoBlending },
    opaqueFront: { side: FrontSide, transparent: false, depthWrite: true, blending: NoBlending },
    additive: {
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
    },
    additiveOneOne: {
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendEquation: AddEquation,
        blendSrcAlpha: OneFactor,
        blendDstAlpha: OneFactor,
        blendEquationAlpha: AddEquation,
    },
    normalTransparent: {
        side: DoubleSide,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
    },
    alphaTest: {
        side: DoubleSide,
        transparent: true,
        depthWrite: true,
        blending: NormalBlending,
    },
};
// Silence unused-import lint in editors for helpers re-exported via usage in brushMaterials
export { Discard, If, texture, uv, vec2, vec3, vec4, float, pow, exp, mix, sin, cos, length, max, normalize, dot, cross, select, frontFacing, positionLocal, modelViewMatrix, modelWorldMatrix, cameraViewMatrix, varying, Fn, };
