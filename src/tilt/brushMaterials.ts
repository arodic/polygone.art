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

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Vector3, Vector4, FrontSide, type Texture } from 'three';
import {
	Discard,
	Fn as tslFn,
	If,
	abs,
	attribute,
	ceil,
	clamp,
	cos,
	cross,
	cameraPosition,
	dFdx,
	dFdy,
	dot,
	exp,
	float,
	floor,
	fract,
	frontFacing,
	interleavedGradientNoise,
	length,
	log2,
	max,
	min,
	mix,
	mod,
	modelWorldMatrix,
	modelWorldMatrixInverse,
	normalize,
	pow,
	select,
	sin,
	screenCoordinate,
	sqrt,
	step,
	texture,
	textureSize,
	varying,
	vec2,
	vec3,
	vec4,
	wgslFn,
} from 'three/tsl';
import {
	BLEND,
	applyCommonMaterialProps,
	applyFog,
	bloomColor,
	brushColor,
	brushNormalAttr,
	brushPositionAttr,
	brushQuadIndex,
	brushTimestamp,
	brushUv2,
	brushUv4,
	bubbleWandPositionLocal,
	bubblesParticlePositionLocal,
	createTiltUniformBag,
	diffuseLighting,
	discoPositionLocal,
	doubleTaperedPositionLocal,
	fogCoordVarying,
	hasNodeBrush,
	hyperGridPositionLocal,
	electricityPositionLocal,
	lambertShader,
	lightWirePositionLocal,
	lightDirVaryings,
	particlePositionLocal,
	perturbNormal,
	perturbNormalFacing,
	rainInflatePositionLocal,
	smokeParticlePositionLocal,
	surfaceLighting,
	surfaceLightingDoubleSide,
	surfaceShaderMetallicRoughness,
	surfaceShaderSpecularGloss,
	shShaderWithSpec,
	toLegacyUniforms,
	viewNormalVarying,
	viewPositionVarying,
	viewTBNVaryings,
	waveformParticlesPositionLocal,
} from './brushCommon.js';

/**
 * TSL `Fn` overloads in @types/three don't model the array-arg form used here.
 * Contextual `any` keeps destructured TSL params from becoming implicit-any.
 */
type TslFn = {
	(jsFunc: (args: any) => any, layout?: string | Record<string, string>): any;
	(jsFunc: () => any, layout?: string | Record<string, string>): any;
};
const Fn = tslFn as TslFn;
function sampleMain(tex: any, uvNode: any) {
	return texture(tex, uvNode);
}

function attachUniforms(material: any, tiltUniforms: any, textures: Record<string, any>) {
	material.userData.tiltUniforms = tiltUniforms;
	material.uniforms = toLegacyUniforms(tiltUniforms, textures);
	material.isTiltNodeMaterial = true;
}

function buildCutoffUnlit({ name, mainTex, cutoff, fog = true, blend = BLEND.opaque }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const fogCoord = fog ? fogCoordVarying() : null;

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w.mul(vColor.a);
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const rgb = fog
			? applyFog(vColor.rgb, fogCoord, u.u_fogColor.node, u.u_fogDensity.node)
			: vColor.rgb;
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildCutoffUnlitNoVertexAlpha({ name, mainTex, cutoff, blend = BLEND.opaque }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w;
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const rgb = applyFog(vColor.rgb, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildSolidUnlit({ name, blend = BLEND.opaqueFront, doubleTaper = false }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const taperedPos = doubleTaper ? doubleTaperedPositionLocal() : null;
	if (taperedPos) {
		material.positionNode = taperedPos;
	}

	const vColor = varying(brushColor(), 'v_tb_color');
	const fogCoord = fogCoordVarying(taperedPos ?? undefined);

	material.fragmentNode = Fn(() => {
		const rgb = applyFog(vColor.rgb, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * Toon: unlit vertex color + slight up-facing brightening (preview GLSL).
 * Not Lambert — that reads darker and shifts hue under scene lights.
 */
function buildToon() {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_Toon';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const lifted = max(vColor.rgb.add(vNormal.y.mul(0.2)), vec3(0, 0, 0));
		const rgb = applyFog(lifted, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * HyperGrid: legacy world quantize + additive tinted MainTex alpha.
 */
function buildHyperGrid({ mainTex, tintColor }: any) {
	const u = createTiltUniformBag({
		u_TintColor: { value: tintColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_HyperGrid';

	material.positionNode = hyperGridPositionLocal(u.u_isNewTiltExporter.node);

	const vColor = varying(brushColor().mul(2), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const mask = sampleMain(mainTex, vUv).w;
		return vColor.mul(u.u_TintColor.node).mul(mask);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Electricity: tapered ribbon + curl displacement + bloomed additive core.
 */
function buildElectricity({ emissionGain, displacementIntensity }: any) {
	const u = createTiltUniformBag({
		u_EmissionGain: { value: emissionGain },
		u_DisplacementIntensity: { value: displacementIntensity },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Electricity';

	material.positionNode = electricityPositionLocal(
		u.u_time.node,
		u.u_DisplacementIntensity.node,
	);

	const uv0 = brushUv2();
	const envelope = sin(uv0.x.mul(3.14159));
	const envelopePow = float(1).sub(pow(float(1).sub(envelope), float(10)));
	const boosted = brushColor().mul(float(1).add(float(1).sub(envelopePow)));
	const vColor = varying(boosted, 'v_tb_color');
	const vUv = varying(uv0, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const color = bloomColor(vColor, u.u_EmissionGain.node);
		const procedural = select(abs(vUv.y.sub(0.5)).lessThan(0.2), float(2), float(0));
		const c = color.add(color.mul(procedural));
		return c.mul(c.a);
	})();

	attachUniforms(material, u, {});
	return material;
}

function buildDiffuseLit({
	name,
	mainTex = null,
	cutoff = null,
	blend = BLEND.opaque,
	a2c = false,
	multiplyVertexAlpha = false,
}: any) {
	const seed: Record<string, any> = {};
	if (cutoff != null) seed.u_Cutoff = { value: cutoff };
	if (a2c) seed.u_A2CEnabled = { value: 1 };
	const u = createTiltUniformBag(seed);
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	if (a2c) material.alphaToCoverage = true;
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();
	const vUv: any = mainTex ? varying(brushUv2(), 'v_tb_uv') : null;

	material.fragmentNode = Fn(() => {
		if (mainTex && cutoff != null && !a2c) {
			let brushMask: any = sampleMain(mainTex, vUv).w;
			if (multiplyVertexAlpha) brushMask = brushMask.mul(vColor.a);
			If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
				Discard();
			});
		}

		const lit = diffuseLighting(
			vNormal,
			ld0,
			ld1,
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);

		if (a2c && mainTex) {
			const texNode = texture(mainTex, vUv);
			const a = texNode.a;
			// Match GLSL CoarseBristles: hard cutoff when A2C off; mip-boosted alpha when on.
			If(u.u_A2CEnabled.node.lessThan(0.5), () => {
				If(a.lessThanEqual(u.u_Cutoff.node), () => {
					Discard();
				});
			});

			const texSize = textureSize(texNode, float(0)).toFloat();
			const dx = dFdx(vUv.mul(texSize));
			const dy = dFdy(vUv.mul(texSize));
			const mip = max(float(0.5).mul(log2(max(dot(dx, dx), dot(dy, dy)))), float(0));
			const adjustedAlpha = clamp(a.mul(float(1).add(mip.mul(0.6))), float(0), float(1));

			If(u.u_A2CEnabled.node.greaterThanEqual(0.5).and(adjustedAlpha.lessThan(0.01)), () => {
				Discard();
			});
			const outAlpha = select(
				u.u_A2CEnabled.node.lessThan(0.5),
				float(1),
				adjustedAlpha,
			);
			return vec4(rgb, outAlpha);
		}

		return vec4(rgb, 1);
	})();

	const textures = mainTex ? { u_MainTex: mainTex } : {};
	attachUniforms(material, u, textures);
	return material;
}

/**
 * LeakyPen: dual-UV MainTex mask (texcoord0.r × vertex alpha) + diffuse sample at texcoord1;
 * simple Lambert on both lights (preview GLSL has no specular or back-face flip).
 */
function buildLeakyPen({ mainTex, cutoff, mainTexST }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_LeakyPen';

	const mainST = mainTexST ?? new Vector4(1, 1, 0, 0);
	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();
	const vUv0 = varying(
		brushUv2().mul(vec2(mainST.x, mainST.y)).add(vec2(mainST.z, mainST.w)),
		'v_tb_uv0',
	);

	material.fragmentNode = Fn(() => {
		const maskTex = sampleMain(mainTex, vUv0);
		const alphaTest = maskTex.r.mul(vColor.a);
		If(alphaTest.lessThan(u.u_Cutoff.node), () => {
			Discard();
		});

		const albedo = vColor.rgb;
		const n = normalize(vNormal);
		const ld0n = normalize(ld0);
		const ld1n = normalize(ld1);
		const lightOut0 = lambertShader(n, ld0n, u.u_SceneLight_0_color.node.rgb, albedo);
		const lightOut1 = lambertShader(n, ld1n, u.u_SceneLight_1_color.node.rgb, albedo);
		const ambientOut = albedo.mul(u.u_ambient_light_color.node.rgb);
		const lit = lightOut0.add(lightOut1).add(ambientOut);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Lofted (Hue Shift): unlit hue vignette (preview fragment has no lighting/fog).
 */
function buildLoftedHueShift({ mainTex }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_Lofted (Hue Shift)';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const tex = mainTex
			? texture(mainTex, vUv).mul(vColor)
			: vColor;

		const shift = float(5).add(vColor.r);
		const hueInput = vColor.r.mul(shift);
		const r = float(-1).add(abs(hueInput.sub(3)));
		const g = float(2).sub(abs(hueInput.sub(2)));
		const b = float(2).sub(abs(hueInput.sub(4)));
		const hueshift = clamp(vec3(r, g, b), float(0), float(1));
		const colorShift = vec4(hueshift, 1);

		const centeredUV = abs(vUv.sub(0.5)).mul(2);
		const huevignette = pow(length(centeredUV), float(2));
		const color = mix(tex, colorShift, clamp(huevignette, float(0), float(1)));
		const premul = vec4(color.rgb.mul(color.a), color.a);
		return premul;
	})();

	const textures = mainTex ? { u_MainTex: mainTex } : {};
	attachUniforms(material, u, textures);
	return material;
}

/** Quill brushes: vertex-alpha A2C dither + hard cutoff fallback (shared fragment). */
function buildQuillA2C({
	name,
	cutoff,
	a2cEnabled,
	ditherStrength,
	orderedDither,
	alphaBias,
	alphaPower,
}: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_A2CEnabled: { value: a2cEnabled },
		u_DitherStrength: { value: ditherStrength },
		u_OrderedDither: { value: orderedDither },
		u_AlphaBias: { value: alphaBias },
		u_AlphaPower: { value: alphaPower },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.alphaToCoverage = true;
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const fogCoord = fogCoordVarying();

	const orderedDither4x4 = wgslFn(`
		fn ordered_dither_4x4(pixel_pos: vec2f) -> f32 {
			let p = vec2i(i32(floor(pixel_pos.x)) & 3, i32(floor(pixel_pos.y)) & 3);
			let index = p.x + p.y * 4;
			var d: i32 = 5;
			switch index {
				case 0: { d = 0; }
				case 1: { d = 8; }
				case 2: { d = 2; }
				case 3: { d = 10; }
				case 4: { d = 12; }
				case 5: { d = 4; }
				case 6: { d = 14; }
				case 7: { d = 6; }
				case 8: { d = 3; }
				case 9: { d = 11; }
				case 10: { d = 1; }
				case 11: { d = 9; }
				case 12: { d = 15; }
				case 13: { d = 7; }
				case 14: { d = 13; }
				default: { d = 5; }
			}
			return (f32(d) + 0.5) / 16.0;
		}
	`);

	material.fragmentNode = Fn(() => {
		const biasedAlpha = clamp(vColor.a.add(u.u_AlphaBias.node), float(0), float(1));
		const alpha = clamp(
			pow(biasedAlpha, max(u.u_AlphaPower.node, float(0.0001))),
			float(0),
			float(1),
		);

		If(u.u_A2CEnabled.node.lessThan(0.5).and(alpha.lessThanEqual(u.u_Cutoff.node)), () => {
			Discard();
		});

		const rgb = applyFog(vColor.rgb, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);

		const t = modelWorldMatrix[3].xyz;
		const objectSeed = fract(sin(dot(t, vec3(0.1031, 0.11369, 0.13787))).mul(43758.5453));
		const pixelPos = screenCoordinate.xy.add(vec2(objectSeed.mul(4096), objectSeed.mul(4096)));
		const ditherOrdered = orderedDither4x4(pixelPos);
		const ditherNoise = interleavedGradientNoise(floor(pixelPos));
		const dither = mix(ditherNoise, ditherOrdered, step(float(0.5), u.u_OrderedDither.node));
		const ditherAmount = u.u_DitherStrength.node.mul(float(1).sub(alpha));
		const adjustedAlpha = clamp(
			alpha.add(dither.sub(0.5).mul(ditherAmount)),
			float(0),
			float(1),
		);

		If(u.u_A2CEnabled.node.greaterThanEqual(0.5).and(adjustedAlpha.lessThan(0.01)), () => {
			Discard();
		});

		const outAlpha = select(u.u_A2CEnabled.node.lessThan(0.5), float(1), adjustedAlpha);
		return vec4(rgb, outAlpha);
	})();

	attachUniforms(material, u, {});
	return material;
}

/** Wireframe: procedural UV grid mask (no fog). */
function buildWireframe() {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.normalTransparent);
	material.name = 'material_Wireframe';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const uv = fract(vUv);
		const wX = select(abs(uv.x.sub(0.5)).greaterThan(0.45), float(1), float(0));
		const wY = select(abs(uv.y.sub(0.5)).greaterThan(0.45), float(1), float(0));
		return vColor.mul(wX.add(wY));
	})();

	attachUniforms(material, u, {});
	return material;
}

/** FacetedTube: facet normal from world-position derivatives + axis colors. */
function buildFacetedTube({ colorX, colorY, colorZ }: any) {
	const u = createTiltUniformBag({
		u_ColorX: { value: colorX },
		u_ColorY: { value: colorY },
		u_ColorZ: { value: colorZ },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_FacetedTube';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vWorldPos = varying(
		modelWorldMatrix.mul(vec4(brushPositionAttr(), 1)).xyz,
		'v_tb_worldpos',
	);

	material.fragmentNode = Fn(() => {
		const n = normalize(cross(dFdy(vWorldPos), dFdx(vWorldPos)));
		const c = mix(vec3(0, 0, 0), u.u_ColorX.node.rgb, n.x)
			.add(mix(vec3(0, 0, 0), u.u_ColorY.node.rgb, n.y))
			.add(mix(vec3(0, 0, 0), u.u_ColorZ.node.rgb, n.z));
		return vec4(c, vColor.a);
	})();

	attachUniforms(material, u, {});
	return material;
}

/** TaperedHueShift: unlit MainTex × color + hue vignette (preview GLSL). */
function buildTaperedHueShift({ mainTex, cutoff }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_TaperedHueShift';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const c = texture(mainTex, vUv).mul(vColor);
		If(c.a.lessThan(u.u_Cutoff.node), () => {
			Discard();
		});

		const hueInput = float(4.5).add(vColor.r.mul(0.5));
		const r = float(-1).add(abs(hueInput.sub(3)));
		const g = float(2).sub(abs(hueInput.sub(2)));
		const b = float(2).sub(abs(hueInput.sub(4)));
		const hueShiftColor = clamp(vec3(r, g, b), float(0), float(1));

		const vignette = pow(abs(vUv.x.sub(0.5)).mul(2), float(2));
		const finalColor = mix(c.rgb, hueShiftColor, clamp(vignette, float(0), float(1)));
		return vec4(finalColor, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Feather / TubeAdditive: unlit MainTex.w × vertex color. */
function buildUnlitMask({ name, mainTex, blend }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const mask = sampleMain(mainTex, vUv).w;
		return vec4(mask.mul(vColor.rgb), float(1));
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** 3D Printing Brush: flat facet normal from view-position derivatives + Lambert. */
function build3DPrinting() {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_3D Printing Brush';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);

	material.fragmentNode = Fn(() => {
		const posDx = dFdx(vPos);
		const posDy = dFdy(vPos);
		const faceNormal = normalize(cross(posDx, posDy));
		const ld0n = normalize(ld0);
		const ld1n = normalize(ld1);
		const ndotl0 = max(dot(faceNormal, ld0n), float(0));
		const ndotl1 = max(dot(faceNormal, ld1n), float(0));
		const lighting = vColor.rgb
			.mul(u.u_ambient_light_color.node.rgb)
			.add(u.u_SceneLight_0_color.node.rgb.mul(ndotl0).mul(vColor.rgb))
			.add(u.u_SceneLight_1_color.node.rgb.mul(ndotl1).mul(vColor.rgb));
		return vec4(lighting, vColor.a);
	})();

	attachUniforms(material, u, {});
	return material;
}

function quillParams(name: any, uniforms: any) {
	return buildQuillA2C({
		name,
		cutoff: uniforms.u_Cutoff?.value ?? 0.067,
		a2cEnabled: uniforms.u_A2CEnabled?.value ?? 1,
		ditherStrength: uniforms.u_DitherStrength?.value ?? 0.5,
		orderedDither: uniforms.u_OrderedDither?.value ?? 0,
		alphaBias: uniforms.u_AlphaBias?.value ?? 0,
		alphaPower: uniforms.u_AlphaPower?.value ?? 1,
	});
}

/**
 * Icing: Disney surface lighting + bump map (matches SurfaceShaderIncludes GLSL).
 * Vertex colors are very dark blue; Lambert alone reads near-black — Disney diffuse + bump recovers the lit blue.
 */
function buildIcing({ mainTex, bumpMap, cutoff, shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_Icing';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const { vNormal, vTangent, vBitangent } = viewTBNVaryings();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	const bump = bumpMap ?? mainTex;

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w.mul(vColor.a);
		// PerturbNormal must run unconditionally (uses derivatives in GLSL; keep order similar).
		const bumped = perturbNormal(vTangent, vBitangent, vNormal, vUv, bump);
		const lit = surfaceLighting(
			bumped,
			ld0,
			ld1,
			vPos.negate(), // eyeDir = -normalize(v_position)
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(rgb, 1);
	})();

	const textures: Record<string, any> = {};
	if (mainTex) textures.u_MainTex = mainTex;
	if (bump) textures.u_BumpMap = bump;
	attachUniforms(material, u, textures);
	return material;
}

function buildHighlighter({ mainTex, cutoff }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Highlighter';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w.mul(vColor.a);
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(vColor.rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildSoftHighlighter({ mainTex }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	// SoftHighlighter GLSL params: CustomBlending One/One
	applyCommonMaterialProps(material, BLEND.additiveOneOne);
	material.name = 'material_SoftHighlighter';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w;
		return vec4(brushMask.mul(vColor.rgb), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildFire({ mainTex, emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additiveOneOne);
	material.name = 'material_Fire';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const scroll1 = float(20);
		const displacementIntensity = float(0.1);
		const timeX = u.u_time.node.x;
		const displacement = sampleMain(mainTex, vUv.add(vec2(timeX.mul(scroll1).negate(), 0))).a;
		const tex = sampleMain(
			mainTex,
			vUv.sub(vec2(0, 0)).sub(vec2(displacement.mul(displacementIntensity), 0)),
		);
		const bloomed = bloomColor(vColor, u.u_EmissionGain.node);
		return bloomed.mul(tex);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildLight({ mainTex, emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additiveOneOne);
	material.name = 'material_Light';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w;
		return bloomColor(vColor, u.u_EmissionGain.node).mul(brushMask);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Waveform: additive bloomed stroke × procedural sine ribbon (preview GLSL GetWaveForm).
 * MainTex is unused in the fragment; rainbow helper is dead code in GLSL too.
 */
function buildWaveform({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Waveform';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		// Frequencies use raw vertex color (GLSL v_unbloomedColor); multiply by bloomed v_color.
		const bloomed = bloomColor(vColor, u.u_EmissionGain.node);
		const timeW = u.u_time.node.w;
		const envelope = sin(vUv.x.mul(3.14159));
		const waveform = float(0.15)
			.mul(sin(float(-30).mul(vColor.r).mul(timeW).add(vUv.x.mul(100).mul(vColor.r))))
			.add(float(0.15).mul(sin(float(-40).mul(vColor.g).mul(timeW).add(vUv.x.mul(100).mul(vColor.g)))))
			.add(float(0.15).mul(sin(float(-50).mul(vColor.b).mul(timeW).add(vUv.x.mul(100).mul(vColor.b)))));
		const pinch = float(1).sub(envelope).mul(40).add(20);
		const proceduralLine = clamp(
			float(1).sub(pinch.mul(abs(vUv.y.sub(0.5).sub(waveform.mul(envelope))))),
			float(0),
			float(1),
		);
		const mask = envelope.mul(proceduralLine);
		return vec4(bloomed.rgb.mul(mask), bloomed.a);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * DoubleTaperedFlat: Disney surface (no bump/tex) + sin(uv.x*PI) stroke taper.
 * Preview GLSL: envelope taper on position; eyeDir from untapered a_position; DoubleSide.
 */
function buildDoubleTaperedFlat({ shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_DoubleTaperedFlat';

	const taperedPos = doubleTaperedPositionLocal();
	material.positionNode = taperedPos;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	// Match GLSL: v_position from original a_position (not tapered).
	const vPos = viewPositionVarying(brushPositionAttr());
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying(taperedPos);

	material.fragmentNode = Fn(() => {
		const lit = surfaceLightingDoubleSide(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * ShinyHull: Disney surface + specular (no bump / cutoff in preview GLSL).
 * FrontSide hull mesh — use surfaceLighting (not DoubleSide facing invert).
 */
function buildShinyHull({ name = 'ShinyHull', shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const lit = surfaceLighting(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * Leaves: Disney surface (SpecColor=0 → diffuse-only) + MainTex.a cutoff + fog.
 * Preview GLSL uses SurfaceShaderInternal (same as SpecularGloss when SpecColor=0);
 * no bump despite BumpMap in the material template.
 * DoubleSide — inverted WGSL frontFacing like Petal.
 */
function buildLeaves({ mainTex, cutoff, shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_Leaves';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const brushMask = sampleMain(mainTex, vUv).w;
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const lit = surfaceLightingDoubleSide(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Stars: camera-facing particles with sparkle brightness + MainTex (additive).
 */
function buildStars({ mainTex, sparkleRate }: any) {
	const u = createTiltUniformBag({ u_SparkleRate: { value: sparkleRate } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Stars';

	material.positionNode = particlePositionLocal();

	const aColor = brushColor();
	const phase = aColor.a.mul(6.28318530718);
	const brightness = float(800).mul(
		pow(abs(sin(u.u_time.node.y.mul(u.u_SparkleRate.node).add(phase))), float(20)),
	);
	const vColor = varying(vec4(aColor.rgb.mul(brightness), 1), 'v_tb_color');
	const vUv = varying(brushUv4().xy, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const color = vColor.mul(sampleMain(mainTex, vUv));
		return vec4(color.rgb.mul(color.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Petal: Disney surface + back-face AO (preview GLSL; color-fade mix is unused).
 * DoubleSide — inverted WGSL frontFacing for lighting + AO.
 */
function buildPetal({ shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_Petal';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const lit = surfaceLightingDoubleSide(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		// GLSL: fAO = gl_FrontFacing ? 1.0 : 0.5 * uv.x — invert for WGSL DoubleSide.
		const fAO = select(frontFacing, vUv.x.mul(0.5), float(1));
		const rgb = applyFog(lit.mul(fAO), fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * WigglyGraphite: Disney diffuse (spec=0) + animated MainTex flipbook cutoff + fog.
 */
function buildWigglyGraphite({ mainTex, cutoff }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_WigglyGraphite';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const anim = ceil(mod(u.u_time.node.y.mul(12), float(6)));
		const scrollUV = vec2(vUv.x.add(anim).mul(1.1), vUv.y);
		const brushMask = sampleMain(mainTex, scrollUV).w.mul(vColor.a);
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const lit = surfaceLightingDoubleSide(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			vec3(0, 0, 0),
			float(0),
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * CelVinyl: unlit MainTex × vertex color + alpha cutoff + fog.
 */
function buildCelVinyl({ mainTex, cutoff }: any) {
	const u = createTiltUniformBag({ u_Cutoff: { value: cutoff } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_CelVinyl';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const tex = sampleMain(mainTex, vUv).mul(vColor);
		If(tex.a.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const rgb = applyFog(tex.rgb, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * NeonPulse: specular-only surface + scrolling neon bloom (One/One additive).
 */
function buildNeonPulse({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additiveOneOne);
	material.name = 'material_NeonPulse';

	const vColor = varying(brushColor(), 'v_tb_color');
	// Legacy NeonPulse TEXCOORD_0 is VEC3 — must declare vec3 (vec2/vec4 mismatch → UV=0 → neon=1).
	const vUv = varying(attribute('a_texcoord0', 'vec3').xy, 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);

	material.fragmentNode = Fn(() => {
		const n = normalize(vNormal);
		// GLSL-matching facing (One/One additive — avoid inverted double-bright).
		const nFacing = select(frontFacing, n, n.negate());
		const ld0n = normalize(ld0);
		const ld1n = normalize(ld1);
		const ed = normalize(vPos.negate());
		const spec = vec3(0.05, 0.05, 0.05);
		const diffuse = vec3(0, 0, 0);
		const lightOut0 = surfaceShaderSpecularGloss(
			nFacing,
			ld0n,
			ed,
			u.u_SceneLight_0_color.node.rgb,
			diffuse,
			spec,
			float(0.8),
		);
		const lightOut1 = shShaderWithSpec(
			nFacing,
			ld1n,
			u.u_SceneLight_1_color.node.rgb,
			diffuse,
			spec,
		);

		let uvX = vUv.x.sub(u.u_time.node.x.mul(15));
		uvX = mod(abs(uvX), float(1));
		const neon = clamp(pow(float(10).mul(clamp(float(0.2).sub(uvX), float(0), float(1))), float(5)), float(0), float(1));

		// Unity Brush.cginc bloomColor (scale 2). Preview GLSL wrongly used 80 and
		// `_EmissionGain` (unbound → 0), so WebGL looked dimmer; Node with 80×exp(5)
		// blew out to white. Match Unity / shared helper.
		let bloom = bloomColor(vColor, u.u_EmissionGain.node);
		const NdotV = abs(dot(normalize(vNormal), ed));
		bloom = bloom.mul(pow(NdotV, float(2))).mul(NdotV);

		return vec4(lightOut0.add(lightOut1).add(neon.mul(bloom.rgb)), 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * LightWire: inflated bulb segments + blinking RGB lights + surface lighting + fog.
 */
function buildLightWire({ shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaqueFront);
	material.name = 'material_LightWire';

	const displaced = lightWirePositionLocal();
	material.positionNode = displaced;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv4().xy, 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying(displaced);

	material.fragmentNode = Fn(() => {
		const envelope = sin(mod(vUv.x.mul(2), float(1)).mul(3.14159));
		const lights = select(envelope.lessThan(0.1), float(1), float(0));
		const border = select(abs(envelope.sub(0.1)).lessThan(0.01), float(0), float(1));

		let specularColor: any = vec3(0.3, 0.3, 0.3).sub(lights.mul(vec3(0.15, 0.15, 0.15)));
		const smoothness = float(0.3).sub(lights.mul(0.3));

		let color: any = vColor;
		const colorindex = floor(mod(vUv.x.mul(2).add(0.5), float(3)));
		const tinted = select(
			colorindex.equal(0),
			color.rgb.mul(vec3(0.2, 0.2, 1)),
			select(
				colorindex.equal(1),
				color.rgb.mul(vec3(1, 0.2, 0.2)),
				color.rgb.mul(vec3(0.2, 1, 0.2)),
			),
		);
		const lightindex = mod(vUv.x.mul(2).add(0.5), float(7));
		const timeindex = mod(u.u_time.node.w, float(7));
		const on = float(1).sub(clamp(abs(lightindex.sub(timeindex)).mul(1.5), float(0), float(1)));
		const bloomed = bloomColor(vec4(tinted.mul(on), color.a), float(0.7));
		color = select(lights.greaterThan(0.5), bloomed, color);

		let diffuseColor: any = float(1).sub(lights).mul(color.rgb).mul(0.2);
		diffuseColor = diffuseColor.mul(border);
		specularColor = specularColor.mul(border);

		const n = normalize(vNormal);
		const nFacing = select(frontFacing, n, n.negate());
		const lit = surfaceShaderSpecularGloss(
			nFacing,
			normalize(ld0),
			normalize(vPos.negate()),
			u.u_SceneLight_0_color.node.rgb,
			diffuseColor,
			specularColor,
			smoothness,
		)
			.add(
				shShaderWithSpec(
					nFacing,
					normalize(ld1),
					u.u_SceneLight_1_color.node.rgb,
					diffuseColor,
					u.u_SpecColor.node,
				),
			)
			.add(diffuseColor.mul(u.u_ambient_light_color.node.rgb));

		const withEmission = lit.add(lights.mul(color.rgb));
		const rgb = applyFog(withEmission, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * DiamondHull: thin-film diffraction rim + Disney surface (One/One additive).
 * All thin-film math is fully inlined (no nested TSL Fn) so R/G/B wavelengths
 * stay independent. Lighting uses GLSL-matching frontFacing (hull, not ribbon).
 */
function buildDiamondHull({ mainTex }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additiveOneOne);
	material.name = 'material_DiamondHull';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const vWorldPos = varying(
		modelWorldMatrix.mul(vec4(brushPositionAttr(), 1)).xyz,
		'v_tb_worldPos',
	);
	const vWorldNormal = varying(
		normalize(modelWorldMatrix.mul(vec4(brushNormalAttr(), 0)).xyz),
		'v_tb_worldNormal',
	);
	const { ld0, ld1 } = lightDirVaryings(u);

	material.fragmentNode = Fn(() => {
		const shininess = float(0.8);
		const albedo = vColor.rgb.mul(0.2);

		const viewDirWorld = normalize(cameraPosition.sub(vWorldPos));
		const normalWorld = normalize(vWorldNormal);
		const normalView = normalize(vNormal);
		const eyeDir = normalize(vPos.negate());

		let rim: any = float(1).sub(abs(dot(viewDirWorld, normalWorld)));
		rim = rim.mul(float(1).sub(pow(rim, float(5))));
		const ndotv = abs(dot(viewDirWorld, normalWorld));
		rim = mix(
			rim,
			float(150),
			float(1).sub(clamp(ndotv.div(0.1), float(0), float(1))),
		);

		const thickTex = sampleMain(mainTex, vec2(rim.add(u.u_time.node.x.mul(0.3)), rim)).rgb;
		const cos0 = abs(dot(normalWorld, viewDirWorld));
		const tThick = thickTex.x.add(thickTex.y).add(thickTex.z).div(3);
		const thick = float(250).mul(float(1).sub(tThick)).add(float(400).mul(tThick));

		const PI = float(3.1415926536);
		const n0 = float(1);
		const n1 = float(1.3);
		const n2 = float(1);
		// n1 > n0 and n1 > n2 → d10 = d12 = 0
		const delta = float(0);
		const sin1 = n0.div(n1).mul(n0.div(n1)).mul(float(1).sub(cos0.mul(cos0)));
		const cos1 = sqrt(max(float(0), float(1).sub(sin1)));
		const sin2 = float(1).sub(cos0.mul(cos0)); // n0/n2 = 1
		const cos2 = sqrt(max(float(0), float(1).sub(sin2)));

		// Fresnel amplitude coeffs (inline; signed values — square via mul, not pow).
		const rs10 = n1.mul(cos1).sub(n0.mul(cos0)).div(n1.mul(cos1).add(n0.mul(cos0)));
		const rs12 = n1.mul(cos1).sub(n2.mul(cos2)).div(n1.mul(cos1).add(n2.mul(cos2)));
		const rp10 = n0.mul(cos1).sub(n1.mul(cos0)).div(n0.mul(cos1).add(n1.mul(cos0)));
		const rp12 = n2.mul(cos1).sub(n1.mul(cos2)).div(n1.mul(cos2).add(n2.mul(cos1)));
		const ts01 = float(2).mul(n0).mul(cos0).div(n0.mul(cos0).add(n1.mul(cos1)));
		const ts12 = float(2).mul(n1).mul(cos1).div(n1.mul(cos1).add(n2.mul(cos2)));
		const tp01 = float(2).mul(n0).mul(cos0).div(n0.mul(cos1).add(n1.mul(cos0)));
		const tp12 = float(2).mul(n1).mul(cos1).div(n1.mul(cos2).add(n2.mul(cos1)));

		const alphaS = rs10.mul(rs12);
		const alphaP = rp10.mul(rp12);
		const betaS = ts01.mul(ts12);
		const betaP = tp01.mul(tp12);
		const beamRatio = n2.mul(cos2).div(n0.mul(cos0));

		const reflectAt = (lambda: any) => {
			const phi = float(2)
				.mul(PI)
				.div(lambda)
				.mul(float(2).mul(n1).mul(thick).mul(cos1))
				.add(delta);
			const tsInt = betaS.mul(betaS).div(
				alphaS.mul(alphaS).sub(float(2).mul(alphaS).mul(cos(phi))).add(1),
			);
			const tpInt = betaP.mul(betaP).div(
				alphaP.mul(alphaP).sub(float(2).mul(alphaP).mul(cos(phi))).add(1),
			);
			return float(1).sub(beamRatio.mul(tsInt.add(tpInt)).div(2));
		};

		const diffraction = vec3(reflectAt(float(650)), reflectAt(float(510)), reflectAt(float(475)));

		const emission = rim
			.mul(vColor.rgb)
			.mul(diffraction)
			.mul(0.5)
			.add(rim.mul(diffraction).mul(0.25));
		const specColor = vColor.rgb.mul(clamp(diffraction, float(0), float(1)));

		// Match GLSL gl_FrontFacing for this hull (not ribbon inverted facing).
		const nFacing = select(frontFacing, normalView, normalView.negate());
		const lit = surfaceShaderSpecularGloss(
			nFacing,
			normalize(ld0),
			eyeDir,
			u.u_SceneLight_0_color.node.rgb,
			albedo,
			specColor,
			shininess,
		)
			.add(
				shShaderWithSpec(
					nFacing,
					normalize(ld1),
					u.u_SceneLight_1_color.node.rgb,
					albedo,
					specColor,
				),
			)
			.add(albedo.mul(u.u_ambient_light_color.node.rgb));

		return vec4(lit.add(emission), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Disney surface + bump + MainTex alpha cutoff (Ink / OilPaint / Paper / ThickPaint / WetPaint).
 * invertFacing true (default): GLSL flips again after PerturbNormal; use
 *   surfaceLightingDoubleSide (WGSL ribbon facing invert). Hypercolor still uses this.
 * invertFacing false: OilPaint-style — GLSL computeLighting has no post-bump flip;
 *   inline PerturbNormal with GLSL-matching frontFacing (nested Fn unreliable;
 *   eye-dir rematerialize zeros N·L when lights aren't camera-aligned).
 *   Ink / OilPaint / Paper / ThickPaint / WetPaint / DuctTape / Charcoal / DryBrush /
 *   InkGeometry / DuctTapeGeometry use this path.
 */
function buildSurfaceBumpCutoff({
	name,
	mainTex,
	bumpMap,
	cutoff,
	shininess,
	specColor,
	invertFacing = true,
	blend = BLEND.opaque,
	useCutoff = true,
}: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const { vNormal, vTangent, vBitangent } = viewTBNVaryings();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();
	const bump = bumpMap ?? mainTex;

	material.fragmentNode = Fn(() => {
		let lit;
		if (invertFacing) {
			const bumped = perturbNormal(vTangent, vBitangent, vNormal, vUv, bump);
			lit = surfaceLightingDoubleSide(
				bumped,
				ld0,
				ld1,
				vPos.negate(),
				u.u_SceneLight_0_color.node.rgb,
				u.u_SceneLight_1_color.node.rgb,
				u.u_ambient_light_color.node.rgb,
				vColor.rgb,
				u.u_SpecColor.node,
				u.u_Shininess.node,
			);
		} else {
			// OilPaint: PerturbNormal owns facing; no post-bump lighting flip.
			// Inline GLSL-matching frontFacing (nested Fn unreliable). No eye-dir
			// rematerialize — that zeros N·L when lights aren't camera-aligned.
			const n0 = select(frontFacing, vNormal, vNormal.negate());
			const t0 = select(frontFacing, vTangent, vTangent.negate());
			const b0 = select(frontFacing, vBitangent, vBitangent.negate());
			const sample = texture(bump, vUv).xyz;
			const zRebuilt = sqrt(
				float(1).sub(clamp(dot(sample.xy, sample.xy), float(0), float(1))),
			);
			const z = select(abs(sample.z).lessThan(0.1), zRebuilt, sample.z);
			const packed = vec3(sample.x, sample.y, z);
			const tangentNormal = packed.mul(2).sub(1);
			const tn = vec3(tangentNormal.x, tangentNormal.y.negate(), tangentNormal.z);
			const nFacing = normalize(
				normalize(t0).mul(tn.x).add(normalize(b0).mul(tn.y)).add(normalize(n0).mul(tn.z)),
			);
			const ed = normalize(vPos.negate());
			const ld0n = normalize(ld0);
			const ld1n = normalize(ld1);
			const lightOut0 = surfaceShaderSpecularGloss(
				nFacing,
				ld0n,
				ed,
				u.u_SceneLight_0_color.node.rgb,
				vColor.rgb,
				u.u_SpecColor.node,
				u.u_Shininess.node,
			);
			const lightOut1 = shShaderWithSpec(
				nFacing,
				ld1n,
				u.u_SceneLight_1_color.node.rgb,
				vColor.rgb,
				u.u_SpecColor.node,
			);
			lit = lightOut0.add(lightOut1).add(vColor.rgb.mul(u.u_ambient_light_color.node.rgb));
		}
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		if (useCutoff) {
			const brushMask = sampleMain(mainTex, vUv).w.mul(vColor.a);
			If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
				Discard();
			});
		}
		return vec4(rgb, 1);
	})();

	const textures: Record<string, any> = {};
	if (mainTex) textures.u_MainTex = mainTex;
	if (bump) textures.u_BumpMap = bump;
	attachUniforms(material, u, textures);
	return material;
}

/**
 * Disney surface + MainTex.a cutoff, no bump (ConcaveHull / Icing without bump).
 * maskVertexAlpha: multiply mask by v_color.a (ConcaveHull GLSL).
 */
function buildDisneyCutoff({
	name,
	mainTex,
	cutoff,
	shininess,
	specColor,
	maskVertexAlpha = false,
	blend = BLEND.opaque,
}: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		let brushMask: any = mainTex ? sampleMain(mainTex, vUv).w : float(1);
		if (maskVertexAlpha) {
			brushMask = brushMask.mul(vColor.a);
		}
		If(brushMask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		const lit = surfaceLighting(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	const textures: Record<string, any> = {};
	if (mainTex) textures.u_MainTex = mainTex;
	attachUniforms(material, u, textures);
	return material;
}

/** VelvetInk: additive MainTex.a × vertex color + fog (preview GLSL). */
function buildVelvetInk({ mainTex }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_VelvetInk';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const brushTex = sampleMain(mainTex, vUv);
		const rgb = applyFog(
			brushTex.a.mul(vColor.rgb),
			fogCoord,
			u.u_fogColor.node,
			u.u_fogDensity.node,
		);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Rainbow: additive procedural 5-row scrolling color bands (preview GetRainbowColor).
 */
function buildRainbow({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Rainbow';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const texcoord = clamp(vUv, float(0), float(1));
		const uvsY = texcoord.y.mul(5);
		const rowId = floor(texcoord.y.mul(5));
		const rowY = mod(uvsY, float(1));
		const scrolled = ceil(mod(rowId.add(u.u_time.node.z), float(5))).sub(1);

		const band = select(
			scrolled.equal(0),
			vec3(1, 0, 0),
			select(
				scrolled.equal(1),
				vec3(0.7, 0.3, 0),
				select(
					scrolled.equal(2),
					vec3(0, 1, 0),
					select(scrolled.equal(3), vec3(0, 0.2, 1), vec3(0.4, 0, 1.2)),
				),
			),
		);
		const pulse = pow(sin(scrolled.add(u.u_time.node.z)).add(1).div(2), float(5));
		const thin = clamp(pow(rowY.mul(float(1).sub(rowY)).mul(5), float(50)), float(0), float(1));
		const tex = band.mul(pulse).mul(thin);
		const color = vColor.rgb.mul(tex).mul(exp(u.u_EmissionGain.node.mul(3)));
		return vec4(color, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * ChromaticWave: additive bloomed RGB procedural sine lines (per-channel frequencies).
 */
function buildChromaticWave({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_ChromaticWave';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const bloomed = bloomColor(vColor, u.u_EmissionGain.node);
		const timeW = u.u_time.node.w;
		let ty = vUv.y.add(vUv.x.mul(3));
		ty = mod(ty.add(vUv.x), float(1));
		ty = mod(ty.add(vUv.x), float(1));

		const wr = float(0.15).mul(
			sin(float(-20).mul(vColor.r).mul(timeW).add(vUv.x.mul(100).mul(vColor.r))),
		);
		const wg = float(0.15).mul(
			sin(float(-30).mul(vColor.g).mul(timeW).add(vUv.x.mul(100).mul(vColor.g))),
		);
		const wb = float(0.15).mul(
			sin(float(-40).mul(vColor.b).mul(timeW).add(vUv.x.mul(100).mul(vColor.b))),
		);

		const lineR = clamp(float(1).sub(abs(ty.sub(0.5).add(wr)).mul(40)), float(0), float(1));
		const lineG = clamp(float(1).sub(abs(ty.sub(0.5).add(wg)).mul(40)), float(0), float(1));
		const lineB = clamp(float(1).sub(abs(ty.sub(0.5).add(wb)).mul(40)), float(0), float(1));
		const procedural = vec3(lineR, lineG, lineB);
		const color = bloomed.rgb.mul(procedural);
		return vec4(color, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * Hypercolor: bump + time-scrolled RGB from MainTex.r + Disney surface lighting.
 */
function buildHypercolor({ mainTex, bumpMap, cutoff, shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_Hypercolor';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const { vNormal, vTangent, vBitangent } = viewTBNVaryings();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();
	const bump = bumpMap ?? mainTex;

	material.fragmentNode = Fn(() => {
		const tex = sampleMain(mainTex, vUv);
		const bumped = perturbNormal(vTangent, vBitangent, vNormal, vUv, bump);
		const scroll = u.u_time.node.z;
		const r = sin(tex.r.mul(2).add(scroll.mul(0.5)).sub(vUv.x)).add(1).mul(2);
		const g = sin(tex.r.mul(3.3).add(scroll.mul(1)).sub(vUv.x)).add(1).mul(2);
		const b = sin(tex.r.mul(4.66).add(scroll.mul(0.25)).sub(vUv.x)).add(1).mul(2);
		const animated = vec3(r, 0, 0).add(vec3(0, g, 0)).add(vec3(0, 0, b));
		const colorMultiplier = float(0.5);
		const diffuseColor = animated.mul(vColor.rgb).mul(colorMultiplier);
		const specularColor = u.u_SpecColor.node.mul(animated).mul(colorMultiplier);
		// WGSL front_facing inverted vs GLSL on DoubleSide — swap the branch.
		const n = select(frontFacing, bumped.negate(), bumped);
		const eyeDir = normalize(vPos.negate());
		const lightOut0 = surfaceShaderSpecularGloss(
			n,
			normalize(ld0),
			eyeDir,
			u.u_SceneLight_0_color.node.rgb,
			diffuseColor,
			specularColor,
			u.u_Shininess.node,
		);
		const lightOut1 = shShaderWithSpec(
			n,
			normalize(ld1),
			u.u_SceneLight_1_color.node.rgb,
			diffuseColor,
			u.u_SpecColor.node,
		);
		const ambientOut = diffuseColor.mul(u.u_ambient_light_color.node.rgb);
		const rgb = applyFog(
			lightOut0.add(lightOut1).add(ambientOut),
			fogCoord,
			u.u_fogColor.node,
			u.u_fogDensity.node,
		);
		If(tex.w.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(rgb, 1);
	})();

	const textures: Record<string, any> = {};
	if (mainTex) textures.u_MainTex = mainTex;
	if (bump) textures.u_BumpMap = bump;
	attachUniforms(material, u, textures);
	return material;
}

/**
 * Disco: normal-pulse vertex displace + faceted Disney lighting + fake up-axis hotspot.
 */
function buildDisco({ shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_Disco';

	material.positionNode = discoPositionLocal(u.u_time.node, u.u_isNewTiltExporter.node);

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying(material.positionNode);
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying(material.positionNode);

	material.fragmentNode = Fn(() => {
		const faceted = normalize(cross(dFdy(vPos), dFdx(vPos)));
		const smoothN = normalize(vNormal);
		const diffuseColor = vec3(0, 0, 0);
		const specularColor = vColor.rgb.mul(u.u_SpecColor.node);
		const eyeDir = normalize(vPos.negate());
		const lightOut0 = surfaceShaderSpecularGloss(
			faceted,
			normalize(ld0),
			eyeDir,
			u.u_SceneLight_0_color.node.rgb,
			diffuseColor,
			specularColor,
			u.u_Shininess.node,
		);
		const lightOut1 = shShaderWithSpec(
			smoothN,
			normalize(ld1),
			u.u_SceneLight_1_color.node.rgb,
			diffuseColor,
			u.u_SpecColor.node,
		);
		const ambientOut = diffuseColor.mul(u.u_ambient_light_color.node.rgb);
		const fake = specularColor.mul(
			pow(abs(dot(faceted, vec3(0, 1, 0))), float(10)).mul(20),
		);
		const lit = lightOut0.add(lightOut1).add(ambientOut).add(fake);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * Comet: staggered RGB scroll into a 1D AlphaMask gradient lookup (additive).
 * Matches Comet fragment GLSL (no fog).
 */
function buildComet({ mainTex, alphaMask, speed, alphaMaskTexelSize }: any) {
	const u = createTiltUniformBag({
		u_Speed: { value: speed },
		u_AlphaMask_TexelSize: { value: alphaMaskTexelSize },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Comet';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const time = u.u_time.node.y.mul(u.u_Speed.node).negate();
		const scrollUV = vUv.add(vec2(time, time));
		const scrollUV2 = vUv.add(vec2(time.mul(1.5), 0));
		const scrollUV3 = vUv.add(vec2(time.mul(0.5), 0));

		const r = sampleMain(mainTex, scrollUV).r;
		const g = sampleMain(mainTex, scrollUV2).g;
		const b = sampleMain(mainTex, scrollUV3).b;

		let lookup = r.add(g).add(b).div(3);
		lookup = lookup.mul(float(1).sub(vUv.x));
		lookup = pow(lookup, float(2)).add(0.125).mul(3);

		const falloff = max(float(0.2).sub(vUv.x).mul(5), float(0));
		const gutter = u.u_AlphaMask_TexelSize.node.x.mul(0.5);
		const uCoord = clamp(lookup.add(falloff), gutter, float(1).sub(gutter));
		const tex = texture(alphaMask, vec2(uCoord, 0));
		return vec4(tex.rgb.mul(vColor.rgb), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex, u_AlphaMask: alphaMask });
	return material;
}

function buildParticleBillboardMaterial({ name, fragmentFn, blend, seed = {}, mainTex }: any) {
	const u = createTiltUniformBag(seed);
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, blend);
	material.name = `material_${name}`;

	const particlePos = particlePositionLocal();
	material.positionNode = particlePos;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv4().xy, 'v_tb_uv');

	material.fragmentNode = fragmentFn({ u, vColor, vUv, mainTex });

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildSmoke({ mainTex, scrollRate }: any) {
	const u = createTiltUniformBag({ u_ScrollRate: { value: scrollRate } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Smoke';

	// Unity Smoke.shader: camera-facing quads + curl-noise center drift.
	material.positionNode = smokeParticlePositionLocal(u.u_time.node);

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv4().xy, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const color = vColor.mul(u.u_TintColor.node).mul(sampleMain(mainTex, vUv));
		return vec4(color.rgb.mul(color.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Bubbles: billboard particles + scroll/curl displace; MainTex rgb × color + alpha highlight.
 */
function buildBubbles({
	mainTex,
	scrollRate,
	scrollJitterIntensity,
	scrollJitterFrequency,
}: any) {
	const u = createTiltUniformBag({
		u_ScrollRate: { value: scrollRate },
		u_ScrollJitterIntensity: { value: scrollJitterIntensity },
		u_ScrollJitterFrequency: { value: scrollJitterFrequency },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Bubbles';

	material.positionNode = bubblesParticlePositionLocal(
		u.u_time.node,
		u.u_ScrollRate.node,
		u.u_ScrollJitterIntensity.node,
		u.u_ScrollJitterFrequency.node,
	);

	// Preview GLSL forces o.color.a = 1.
	const vColor = varying(vec4(brushColor().rgb, 1), 'v_tb_color');
	const vUv = varying(brushUv4().xy, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const tex = sampleMain(mainTex, vUv);
		const basecolor = vColor.rgb.mul(tex.rgb);
		const highlightcolor = tex.aaa;
		return vec4(basecolor.add(highlightcolor), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Streamers: additive flowing/scrolling MainTex ribbons (preview GLSL).
 */
function buildStreamers({ mainTex, emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Streamers';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const rowId = floor(vUv.y.mul(5));
		const rowRand = fract(
			sin(dot(vec2(rowId, rowId), vec2(12.9898, 78.233).mul(2))).mul(43758.5453),
		);
		const uvsX0 = vUv.x.add(rowRand.mul(200));
		const sins = sin(uvsX0.mul(vec2(10, 23)).add(u.u_time.node.z.mul(vec2(5, 3))));
		const uvsY = float(5).mul(vUv.y).add(dot(vec2(0.05, -0.05), sins));
		const scrollScale = float(0.5).add(rowRand.mul(0.3));
		const scrollSpeed = float(1).add(mod(rowId.mul(1.61803398875), float(1)).sub(0.5));
		const uvs = vec2(uvsX0.mul(scrollScale).sub(u.u_time.node.y.mul(scrollSpeed)), uvsY);

		let tex: any = sampleMain(mainTex, uvs);
		tex = tex.add(pow(tex, vec4(2, 2, 2, 2)).mul(55));
		const edge = mod(uvs.y, float(1));
		tex = tex.mul(edge).mul(edge).mul(float(1).sub(edge)).mul(float(1).sub(edge));

		const color = vColor.mul(tex).mul(exp(u.u_EmissionGain.node.mul(5)));
		return vec4(color.rgb.mul(color.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * Plasma: additive scrolling MainTex layers + procedural lines (preview Additive.glsl g=0.2).
 * Vertex applies u_MainTex_ST tiling (default 0.5, 1).
 */
function buildPlasma({ mainTex, mainTexST }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Plasma';

	const st = mainTexST ?? new Vector4(0.5, 1, 0, 0);
	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(
		brushUv2().mul(vec2(st.x, st.y)).add(vec2(st.z, st.w)),
		'v_tb_uv',
	);

	material.fragmentNode = Fn(() => {
		const A = vec3(0.55, 0.3, 0.7);
		const aRate = vec3(1.2, 1.0, 1.33);
		const M = vec3(1.0, 2.2, 1.5);
		const bRate = vec3(1.5, 3.0, 2.25).add(M.mul(aRate));
		const LINE_POS = vec3(0.5, 0.5, 0.5);
		const LINE_WIDTH = vec3(0.012, 0.012, 0.012);
		const timeY = u.u_time.node.y;

		const us = A.mul(vUv.x).sub(aRate.mul(timeY));
		let tmp: any = M.mul(A).mul(vUv.x).sub(bRate.mul(timeY));
		tmp = abs(fract(tmp).sub(0.5));
		let vs: any = vUv.y.add(float(0.4).mul(vColor.a).mul(vec3(1, -1, 1)).mul(tmp));
		vs = clamp(
			mix(vs.sub(0.5).mul(4), vs, sin(float(1.570795).mul(vColor.a))),
			float(0),
			float(1),
		);

		let tex: any = sampleMain(mainTex, vec2(abs(us.x), vs.x));
		tex = tex.add(sampleMain(mainTex, vec2(us.y, vs.y)));
		tex = tex.add(sampleMain(mainTex, vec2(us.z, vs.z)));

		// abs() keeps pow defined for vs < LINE_POS (GLSL pow of negatives is undefined).
		const procline = float(1).sub(
			clamp(
				pow(abs(vs.sub(LINE_POS).div(LINE_WIDTH)), vec3(2, 2, 0.2)),
				float(0),
				float(1),
			),
		);
		tex = tex.add(dot(procline, vec3(1, 1, 1)).mul(0.5));

		const brightness = float(0.8).mul(
			float(1).add(
				float(30).mul(
					pow(vec3(1, 1, 0.1).sub(vec3(vColor.a, vColor.a, vColor.a)), vec3(5, 5, 5)),
				),
			),
		);
		tex = vec4(tex.rgb.mul(brightness), tex.a).mul(vColor);
		return vec4(tex.rgb.mul(tex.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildDots({ mainTex, emissionGain, baseGain }: any) {
	return buildParticleBillboardMaterial({
		name: 'Dots',
		mainTex,
		blend: BLEND.additive,
		seed: {
			u_EmissionGain: { value: emissionGain },
			u_BaseGain: { value: baseGain },
		},
		fragmentFn: ({ u, vColor, vUv, mainTex: tex }: any) =>
			Fn(() => {
				const texSample = sampleMain(tex, vUv);
				const c = vColor.mul(u.u_TintColor.node).mul(u.u_BaseGain.node).mul(texSample);
				const rgb = c.rgb.add(c.rgb.mul(c.a).mul(u.u_EmissionGain.node));
				return vec4(rgb, 1);
			})(),
	});
}

function buildEmbers({ mainTex }: any) {
	const u = createTiltUniformBag({
		u_ScrollRate: { value: 0.6 },
		u_ScrollDistance: { value: undefined },
		u_ScrollJitterIntensity: { value: 0.03 },
		u_ScrollJitterFrequency: { value: 5 },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Embers';

	const particlePos = particlePositionLocal();
	const texcoord0 = brushUv4();
	const aColor = brushColor();

	const t = mod(
		u.u_time.node.y.mul(u.u_ScrollRate.node).add(aColor.a.mul(10)),
		float(1),
	);
	const t2 = u.u_time.node.y;

	const worldPosBase = modelWorldMatrix.mul(vec4(particlePos, 1)).xyz;
	const dispBase = modelWorldMatrix
		.mul(vec4(u.u_ScrollDistance.node, 0))
		.xyz.mul(t);

	const jitterX = sin(
		t.mul(u.u_ScrollJitterFrequency.node).add(aColor.a.mul(100)).add(t2).add(worldPosBase.z),
	).mul(u.u_ScrollJitterIntensity.node);
	const jitterY = mod(aColor.a.mul(100), float(1))
		.sub(0.5)
		.mul(u.u_ScrollDistance.node.y)
		.mul(t);
	const jitterZ = cos(
		t.mul(u.u_ScrollJitterFrequency.node).add(aColor.a.mul(100)).add(t2).add(worldPosBase.x),
	).mul(u.u_ScrollJitterIntensity.node);

	const worldPos = worldPosBase.add(dispBase).add(vec3(jitterX, jitterY, jitterZ));

	// Convert world → object for positionNode (MeshBasicNodeMaterial applies model matrix).
	// WGSL has no matrix inverse(); use the CPU-updated uniform instead.
	const objectPos = modelWorldMatrixInverse.mul(vec4(worldPos, 1)).xyz;
	material.positionNode = objectPos;

	const incolor = aColor.rgb;
	const tMinus1 = float(1).sub(t);
	const sparkle = pow(abs(sin(t2.mul(3).add(aColor.a.mul(10)))), float(30));
	const animatedColor = incolor
		.add(pow(tMinus1, float(10)).mul(incolor).mul(200))
		.add(incolor.mul(sparkle).mul(50))
		.mul(incolor)
		.mul(pow(tMinus1, float(2)))
		.mul(5);

	const vColor = varying(vec4(animatedColor, aColor.a), 'v_tb_color');
	const vUv = varying(texcoord0.xy, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const color = float(2).mul(vColor).mul(u.u_TintColor.node).mul(sampleMain(mainTex, vUv));
		return color;
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

function buildSnow({ mainTex, scrollRate, scrollDistance, jitterIntensity, jitterFrequency }: any) {
	const u = createTiltUniformBag({
		u_ScrollRate: { value: scrollRate },
		u_ScrollDistance: { value: scrollDistance },
		u_ScrollJitterIntensity: { value: jitterIntensity },
		u_ScrollJitterFrequency: { value: jitterFrequency },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Snow';

	const particlePos = particlePositionLocal();
	const texcoord0 = brushUv4();
	const aColor = brushColor();

	// GLSL: t = mod(_Time.y * ScrollRate + a_color.a, 1)
	const t = mod(u.u_time.node.y.mul(u.u_ScrollRate.node).add(aColor.a), float(1));
	const t2 = u.u_time.node.y;

	const worldPosBase = modelWorldMatrix.mul(vec4(particlePos, 1)).xyz;
	// dispVec = (t - 0.5) * ScrollDistance
	const dispBase = u.u_ScrollDistance.node.mul(t.sub(0.5));
	const jitterX = sin(t.mul(u.u_ScrollJitterFrequency.node).add(t2)).mul(
		u.u_ScrollJitterIntensity.node,
	);
	const jitterZ = cos(t.mul(u.u_ScrollJitterFrequency.node).mul(0.5).add(t2)).mul(
		u.u_ScrollJitterIntensity.node,
	);
	const worldPos = worldPosBase.add(dispBase).add(vec3(jitterX, 0, jitterZ));
	material.positionNode = modelWorldMatrixInverse.mul(vec4(worldPos, 1)).xyz;

	// v_color.a = pow(1 - abs(2*(t-0.5)), 3)
	const fade = pow(float(1).sub(abs(t.sub(0.5).mul(2))), float(3));
	const vColor = varying(vec4(aColor.rgb, fade), 'v_tb_color');
	const vUv = varying(texcoord0.xy, 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const color = float(2).mul(vColor).mul(u.u_TintColor.node).mul(sampleMain(mainTex, vUv));
		return vec4(color.rgb.mul(color.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/**
 * BlocksBasic: Disney surface + SH + ambient + fog (DoubleSide blocks).
 */
function buildBlocksBasic({ shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_BlocksBasic';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const lit = surfaceLighting(
			vNormal,
			ld0,
			ld1,
			vPos.negate(),
			u.u_SceneLight_0_color.node.rgb,
			u.u_SceneLight_1_color.node.rgb,
			u.u_ambient_light_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * BlocksGlass: specular-only + rim + backface dimming (additive).
 */
function buildBlocksGlass({ shininess, rimIntensity, rimPower, color }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_RimIntensity: { value: rimIntensity },
		u_RimPower: { value: rimPower },
		u_Color: { value: color },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_BlocksGlass';

	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0 } = lightDirVaryings(u);

	material.fragmentNode = Fn(() => {
		const n = normalize(vNormal);
		// GLSL-matching facing for solid blocks under additive blend.
		const nFacing = select(frontFacing, n, n.negate());
		const backfaceDimming = select(frontFacing, float(1), float(0.25));
		const ld0n = normalize(ld0);
		const ed = normalize(vPos.negate());
		const diffuse = vec3(0, 0, 0);
		const specularColor = u.u_Color.node.rgb;
		const lightOut0 = surfaceShaderSpecularGloss(
			nFacing,
			ld0n,
			ed,
			u.u_SceneLight_0_color.node.rgb,
			diffuse,
			specularColor,
			u.u_Shininess.node,
		);
		const viewAngle = clamp(dot(ed, nFacing), float(0), float(1));
		const rim = pow(float(1).sub(viewAngle), u.u_RimPower.node).mul(u.u_RimIntensity.node);
		const rimColor = vec3(rim, rim, rim);
		return vec4(lightOut0.add(rimColor).mul(backfaceDimming), 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

const blocksGemInoiseWgsl = wgslFn(`
fn blocksGemInoise(P: vec3f, jitter: f32) -> vec2f {
	let K = 0.142857142857;
	let Ko = 0.428571428571;
	// GLSL-compatible mod (WGSL % differs for negatives)
	let Pi = floor(P) - 289.0 * floor(floor(P) / 289.0);
	let Pf = fract(P);
	let oi = vec3f(-1.0, 0.0, 1.0);
	let ofv = vec3f(-0.5, 0.5, 1.5);
	var t = (34.0 * (Pi.x + oi) + 1.0) * (Pi.x + oi);
	let px = t - 289.0 * floor(t / 289.0);
	t = (34.0 * (Pi.y + oi) + 1.0) * (Pi.y + oi);
	let py = t - 289.0 * floor(t / 289.0);
	var F = vec2f(1e6, 1e6);
	for (var i = 0; i < 3; i++) {
		for (var j = 0; j < 3; j++) {
			var p = (34.0 * (px[i] + py[j] + Pi.z + oi) + 1.0) * (px[i] + py[j] + Pi.z + oi);
			p = p - 289.0 * floor(p / 289.0);
			let ox = fract(p * K) - Ko;
			var oy = floor(p * K);
			oy = oy - 7.0 * floor(oy / 7.0);
			oy = oy * K - Ko;
			p = (34.0 * p + 1.0) * p;
			p = p - 289.0 * floor(p / 289.0);
			let oz = fract(p * K) - Ko;
			let dx = Pf.x - ofv[i] + jitter * ox;
			let dy = Pf.y - ofv[j] + jitter * oy;
			let dz = Pf.z - ofv + jitter * oz;
			let d = dx * dx + dy * dy + dz * dz;
			for (var n = 0; n < 3; n++) {
				if (d[n] < F.x) {
					F.y = F.x;
					F.x = d[n];
				} else if (d[n] < F.y) {
					F.y = d[n];
				}
			}
		}
	}
	return F;
}
`);

/**
 * BlocksGem: voronoi-perturbed specular gem + diffraction + rim.
 */
function buildBlocksGem({ shininess, rimIntensity, rimPower, frequency, jitter, color }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_RimIntensity: { value: rimIntensity },
		u_RimPower: { value: rimPower },
		u_Frequency: { value: frequency },
		u_Jitter: { value: jitter },
		u_Color: { value: color },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_BlocksGem';

	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const vLocal = varying(brushPositionAttr(), 'v_tb_localpos');
	const { ld0 } = lightDirVaryings(u);

	material.fragmentNode = Fn(() => {
		let normal = normalize(vNormal);
		// fBm_F0: inoise(p * freq*4, jitter) * amp(0.5)
		const F = blocksGemInoiseWgsl(vLocal.mul(u.u_Frequency.node.mul(4)), u.u_Jitter.node).mul(0.5);
		const gem = F.y.sub(F.x);
		normal = normalize(
			vec3(
				normal.x.add(dFdx(gem).mul(50)),
				normal.y.add(dFdy(gem).mul(50)),
				normal.z,
			),
		);

		const ld0n = normalize(ld0);
		const ed = normalize(vPos.negate());
		const diffuse = vec3(0, 0, 0);
		const refl = ed.sub(normal.mul(float(2).mul(dot(ed, normal)))).add(vec3(gem, gem, gem));
		const colorRamp = vec3(1, 0.3, 0)
			.mul(sin(refl.x.mul(30)))
			.add(vec3(0, 1, 0.5).mul(cos(refl.y.mul(37.77))))
			.add(vec3(0, 0, 1).mul(sin(refl.z.mul(43.33))));
		const specularColor = u.u_Color.node.rgb.add(colorRamp.mul(0.5));
		const lightOut0 = surfaceShaderSpecularGloss(
			normal,
			ld0n,
			ed,
			u.u_SceneLight_0_color.node.rgb,
			diffuse,
			specularColor,
			u.u_Shininess.node,
		);
		const viewAngle = clamp(dot(ed, normal), float(0), float(1));
		const rim = pow(float(1).sub(viewAngle), u.u_RimPower.node);
		const rimColor = vec3(rim, rim, rim).mul(u.u_RimIntensity.node);
		return vec4(lightOut0.add(rimColor), 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/**
 * PbrTemplate: metallic/roughness surface × BaseColorTex + fog.
 * Each imported mesh has its own BaseColorTex / factors — do not share materials.
 */
function buildPbrTemplate({
	baseColorTex,
	metallicFactor,
	roughnessFactor,
	baseColorFactor,
}: any) {
	const u = createTiltUniformBag({
		u_MetallicFactor: { value: metallicFactor },
		u_RoughnessFactor: { value: roughnessFactor },
		u_BaseColorFactor: { value: baseColorFactor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_PbrTemplate';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const baseColorTexSample = sampleMain(baseColorTex, vUv);
		const albedo = baseColorTexSample.rgb
			.mul(u.u_BaseColorFactor.node.rgb)
			.mul(vColor.rgb);
		const mask = baseColorTexSample.a
			.mul(u.u_BaseColorFactor.node.a)
			.mul(vColor.a);

		const n = normalize(vNormal);
		const nFacing = select(frontFacing, n, n.negate());
		const ld0n = normalize(ld0);
		const ld1n = normalize(ld1);
		const ed = normalize(vPos.negate());
		const lightOut0 = surfaceShaderMetallicRoughness(
			nFacing,
			ld0n,
			ed,
			u.u_SceneLight_0_color.node.rgb,
			albedo,
			u.u_MetallicFactor.node,
			u.u_RoughnessFactor.node,
		);
		const lightOut1 = surfaceShaderMetallicRoughness(
			nFacing,
			ld1n,
			ed,
			u.u_SceneLight_1_color.node.rgb,
			albedo,
			u.u_MetallicFactor.node,
			u.u_RoughnessFactor.node,
		);
		const ambientOut = albedo.mul(u.u_ambient_light_color.node.rgb);
		const lit = lightOut0.add(lightOut1).add(ambientOut);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, mask);
	})();

	attachUniforms(material, u, { u_BaseColorTex: baseColorTex });
	return material;
}

/**
 * PbrTransparentTemplate: metallic/roughness surface × BaseColorTex + alpha cutoff + fog.
 * Each imported mesh has its own BaseColorTex / factors — do not share materials.
 */
function buildPbrTransparentTemplate({
	baseColorTex,
	metallicFactor,
	roughnessFactor,
	baseColorFactor,
	cutoff,
}: any) {
	const u = createTiltUniformBag({
		u_MetallicFactor: { value: metallicFactor },
		u_RoughnessFactor: { value: roughnessFactor },
		u_BaseColorFactor: { value: baseColorFactor },
		u_Cutoff: { value: cutoff },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.alphaTest);
	material.name = 'material_PbrTransparentTemplate';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const baseColorTexSample = sampleMain(baseColorTex, vUv);
		const albedo = baseColorTexSample.rgb
			.mul(u.u_BaseColorFactor.node.rgb)
			.mul(vColor.rgb);
		const mask = baseColorTexSample.a
			.mul(u.u_BaseColorFactor.node.a)
			.mul(vColor.a);

		const n = normalize(vNormal);
		const nFacing = select(frontFacing, n, n.negate());
		const ld0n = normalize(ld0);
		const ld1n = normalize(ld1);
		const ed = normalize(vPos.negate());
		const lightOut0 = surfaceShaderMetallicRoughness(
			nFacing,
			ld0n,
			ed,
			u.u_SceneLight_0_color.node.rgb,
			albedo,
			u.u_MetallicFactor.node,
			u.u_RoughnessFactor.node,
		);
		const lightOut1 = surfaceShaderMetallicRoughness(
			nFacing,
			ld1n,
			ed,
			u.u_SceneLight_1_color.node.rgb,
			albedo,
			u.u_MetallicFactor.node,
			u.u_RoughnessFactor.node,
		);
		const ambientOut = albedo.mul(u.u_ambient_light_color.node.rgb);
		const lit = lightOut0.add(lightOut1).add(ambientOut);
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		If(mask.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(rgb, mask);
	})();

	attachUniforms(material, u, { u_BaseColorTex: baseColorTex });
	return material;
}

/** Wind: scrolling additive MainTex × vertex color (preview GLSL). */
function buildWind({ mainTex, speed }: any) {
	const u = createTiltUniformBag({ u_Speed: { value: speed } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Wind';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const scrollUV = vec2(vUv.x.add(u.u_time.node.y.mul(u.u_Speed.node).mul(0.5)), vUv.y);
		const tex = sampleMain(mainTex, scrollUV);
		const color = tex.mul(vColor);
		return vec4(color.rgb.mul(color.a), color.a);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Drafting: additive MainTex × color with opacity (preview GLSL). */
function buildDrafting({ mainTex, opacity }: any) {
	const u = createTiltUniformBag({ u_Opacity: { value: opacity } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Drafting';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const tex = sampleMain(mainTex, vUv);
		const color = vColor.mul(tex);
		const rgb = color.rgb.mul(color.a).mul(u.u_Opacity.node);
		return vec4(rgb, 1).mul(u.u_Opacity.node);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Rain: tube inflate + animated UV strips (preview GLSL). */
function buildRain({ mainTex, numSides, speed, mainTexST }: any) {
	const u = createTiltUniformBag({
		u_NumSides: { value: numSides },
		u_Speed: { value: speed },
		u_MainTex_ST: { value: mainTexST },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Rain';

	const inflated = rainInflatePositionLocal();
	material.positionNode = inflated;

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const timeScale = float(0.3);
		const uScale = u.u_Speed.node;
		const t = mod(u.u_time.node.y.mul(timeScale).mul(4).mul(uScale), uScale);
		const uvs = vUv;
		let uCoord: any = uvs.x.mul(uScale).sub(t);
		const rowId = floor(uvs.y.mul(u.u_NumSides.node));
		const rand = abs(
			fract(sin(dot(vec2(rowId, rowId), vec2(12.9898, 78.233).mul(2))).mul(4550)),
		).mul(0.7);
		uCoord = uCoord.add(rand.mul(u.u_time.node.y).mul(timeScale).mul(2.75).mul(uScale));
		uCoord = mod(uCoord, uScale);
		const vCoord = uvs.y.mul(u.u_NumSides.node);
		const st = u.u_MainTex_ST.node;
		const tiledUV = vec2(
			uCoord.mul(st.x).add(st.z),
			vCoord.mul(st.y).add(st.w),
		);
		let tex: any = sampleMain(mainTex, tiledUV);
		tex = select(uCoord.lessThan(0), vec4(0, 0, 0, 0), tex);
		tex = select(uCoord.greaterThan(1), vec4(0, 0, 0, 0), tex);
		const fade = pow(abs(vUv.x.mul(0.25)), float(9));
		const color = vColor.mul(tex);
		const finalColor = mix(color, vec4(0, 0, 0, 0), clamp(fade, float(0), float(1)));
		return vec4(finalColor.rgb.mul(finalColor.a), finalColor.a);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Shared procedural waveform mask (Waveform / WaveformFFT preview GLSL). */
function waveformProceduralMask(uv: any, rawColor: any, timeW: any) {
	const envelope = sin(uv.x.mul(3.14159));
	const waveform = float(0.15)
		.mul(sin(float(-30).mul(rawColor.r).mul(timeW).add(uv.x.mul(100).mul(rawColor.r))))
		.add(float(0.15).mul(sin(float(-40).mul(rawColor.g).mul(timeW).add(uv.x.mul(100).mul(rawColor.g)))))
		.add(float(0.15).mul(sin(float(-50).mul(rawColor.b).mul(timeW).add(uv.x.mul(100).mul(rawColor.b)))));
	const pinch = float(1).sub(envelope).mul(40).add(20);
	const proceduralLine = clamp(
		float(1).sub(pinch.mul(abs(uv.y.sub(0.5).sub(waveform.mul(envelope))))),
		float(0),
		float(1),
	);
	return envelope.mul(proceduralLine);
}

/** WaveformFFT: vertex-bloomed color × procedural lines (preview GLSL). */
function buildWaveformFFT({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_WaveformFFT';

	const rawColor = brushColor();
	const vColor = varying(bloomColor(rawColor, u.u_EmissionGain.node), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const mask = waveformProceduralMask(vUv, rawColor, u.u_time.node.w);
		return vColor.mul(mask);
	})();

	attachUniforms(material, u, {});
	return material;
}

/** WaveformTube: scrolling wavetable distortion (preview GLSL). */
function buildWaveformTube({ mainTex }: any) {
	const u = createTiltUniformBag();
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_WaveformTube';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		let uvCoord: any = vUv;
		uvCoord = vec2(uvCoord.x.sub(u.u_time.node.x), uvCoord.y.add(uvCoord.x));
		uvCoord = vec2(uvCoord.x.mul(0.25), uvCoord.y);
		const wav = sampleMain(mainTex, vec2(uvCoord.x, 0)).x.sub(0.5);
		uvCoord = vec2(uvCoord.x, uvCoord.y.add(wav));
		return vColor.mul(sampleMain(mainTex, uvCoord));
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** WaveformParticles: curl-displaced ribbons + additive MainTex (preview GLSL). */
function buildWaveformParticles({ mainTex, opacity }: any) {
	const u = createTiltUniformBag({
		u_Opacity: { value: opacity },
		u_TintColor: { value: new Vector4(1, 1, 1, 1) },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_WaveformParticles';

	material.positionNode = waveformParticlesPositionLocal(u.u_time.node);

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const c = vColor.mul(u.u_TintColor.node).mul(sampleMain(mainTex, vUv));
		return vec4(c.rgb.mul(c.a), c.a).mul(u.u_Opacity.node);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Space: analogous HSV fbm stroke + Unity bloom (preview GLSL). */
function buildSpace({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Space';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	const spaceHash2 = Fn(([p]) => fract(sin(dot(p, vec2(12.9898, 78.233))).mul(43758.5453)));
	const spaceNoise2 = Fn(([p]) => {
		const i = floor(p);
		const f = fract(p);
		const uFade = f.mul(f).mul(float(3).sub(f.mul(2)));
		const a = spaceHash2(i);
		const b = spaceHash2(i.add(vec2(1, 0)));
		const c = spaceHash2(i.add(vec2(0, 1)));
		const d = spaceHash2(i.add(vec2(1, 1)));
		return mix(mix(a, b, uFade.x), mix(c, d, uFade.x), uFade.y);
	});
	const spaceFbm2 = Fn(([p]) => {
		let value: any = float(0);
		let amplitude: any = float(0.5);
		let pp: any = p;
		value = value.add(amplitude.mul(spaceNoise2(pp)));
		pp = pp.mul(2);
		amplitude = amplitude.mul(0.5);
		value = value.add(amplitude.mul(spaceNoise2(pp)));
		pp = pp.mul(2);
		amplitude = amplitude.mul(0.5);
		return value.add(amplitude.mul(spaceNoise2(pp)));
	});
	const spaceHash3 = Fn(([p]) =>
		fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))).mul(43758.5453)),
	);
	const spaceNoise3 = Fn(([p]) => {
		const i = floor(p);
		const f = fract(p);
		const uFade = f.mul(f).mul(float(3).sub(f.mul(2)));
		const n000 = spaceHash3(i);
		const n100 = spaceHash3(i.add(vec3(1, 0, 0)));
		const n010 = spaceHash3(i.add(vec3(0, 1, 0)));
		const n110 = spaceHash3(i.add(vec3(1, 1, 0)));
		const n001 = spaceHash3(i.add(vec3(0, 0, 1)));
		const n101 = spaceHash3(i.add(vec3(1, 0, 1)));
		const n011 = spaceHash3(i.add(vec3(0, 1, 1)));
		const n111 = spaceHash3(i.add(vec3(1, 1, 1)));
		const nx00 = mix(n000, n100, uFade.x);
		const nx10 = mix(n010, n110, uFade.x);
		const nx01 = mix(n001, n101, uFade.x);
		const nx11 = mix(n011, n111, uFade.x);
		const nxy0 = mix(nx00, nx10, uFade.y);
		const nxy1 = mix(nx01, nx11, uFade.y);
		return mix(nxy0, nxy1, uFade.z);
	});
	const spaceFbm3 = Fn(([p]) => {
		let value: any = float(0);
		let amplitude: any = float(0.5);
		let pp: any = p;
		value = value.add(amplitude.mul(spaceNoise3(pp)));
		pp = pp.mul(2);
		amplitude = amplitude.mul(0.5);
		value = value.add(amplitude.mul(spaceNoise3(pp)));
		pp = pp.mul(2);
		amplitude = amplitude.mul(0.5);
		return value.add(amplitude.mul(spaceNoise3(pp)));
	});

	material.fragmentNode = Fn(() => {
		const gain = float(10);
		const gain2 = float(0);
		const analogSpread = float(0.1);
		const r = abs(vUv.y.mul(2).sub(1));

		const maxC = max(max(vColor.r, vColor.g), vColor.b);
		const minC = min(min(vColor.r, vColor.g), vColor.b);
		const delta = maxC.sub(minC);
		const hue = select(
			maxC.equal(minC),
			float(0),
			select(
				maxC.equal(vColor.r),
				mod(
					vColor.g.sub(vColor.b).div(delta).add(select(vColor.g.lessThan(vColor.b), float(6), float(0))),
					float(1),
				),
				select(
					maxC.equal(vColor.g),
					vColor.b.sub(vColor.r).div(delta).add(2),
					vColor.r.sub(vColor.g).div(delta).add(4),
				).div(6),
			),
		);
		const sat = select(maxC.lessThan(1e-10), float(0), delta.div(maxC));
		const val = maxC;

		const primaryHue = hue;
		const analog1Hue = fract(primaryHue.sub(analogSpread));
		const analog2Hue = fract(primaryHue.add(analogSpread));

		let primaryA: any = float(0.2).mul(spaceFbm2(vUv.add(vec2(u.u_time.node.x, 0)))).mul(gain).add(gain2);
		let analog1A: any = float(0.2)
			.mul(
				spaceFbm3(
					vec3(vUv.x.add(12.52), vUv.y.add(12.52), u.u_time.node.x.mul(5.2)),
				),
			)
			.mul(gain)
			.add(gain2);
		let analog2A: any = float(0.2)
			.mul(
				spaceFbm3(
					vec3(vUv.x.add(6.253), vUv.y.add(6.253), u.u_time.node.x.mul(0.8)),
				),
			)
			.mul(gain)
			.add(gain2);

		const rfbmRand = spaceFbm2(vec2(u.u_time.node.x.add(50), vUv.x)).mul(2);
		primaryA = mix(
			primaryA,
			float(0),
			clamp(r.add(rfbmRand).sub(0).div(0.5), float(0), float(1)),
		);
		analog1A = mix(float(0), analog1A.mul(1.2), clamp(r.sub(0.2).div(0.8), float(0), float(1)));
		analog2A = mix(float(0), analog2A.mul(1.2), clamp(r.sub(0.2).div(0.8), float(0), float(1)));

		const alpha = primaryA.add(analog1A).add(analog2A);
		const finalHue = primaryA
			.mul(primaryHue)
			.add(analog1A.mul(analog1Hue))
			.add(analog2A.mul(analog2Hue))
			.div(max(alpha, 1e-6));

		let lum: any = float(1).sub(r);
		let rfbm: any = spaceFbm2(vec2(vUv.x, u.u_time.node.x)).add(1.2).mul(0.8);
		lum = lum.mul(step(r, rfbm));
		const edgeT = clamp(r.sub(rfbm.sub(0.2)).div(0.2), float(0), float(1));
		const smooth = edgeT.mul(edgeT).mul(float(3).sub(edgeT.mul(2)));
		lum = lum.mul(smooth);

		const hh = fract(finalHue.add(vec3(1, 2 / 3, 1 / 3)));
		const p = abs(hh.mul(6).sub(3));
		const rgb = val.mul(lum).mul(mix(vec3(1, 1, 1), clamp(p.sub(1), float(0), float(1)), sat));

		let color: any = vec4(rgb, alpha);
		color = clamp(color, float(0), float(1));
		color = bloomColor(color, u.u_EmissionGain.node);
		return vec4(color.rgb, 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/** Sparks: stretched animated strips + exp bloom (preview GLSL). */
function buildSparks({
	mainTex,
	emissionGain,
	stretchDistortionExponent,
	numSides,
	speed,
}: any) {
	const u = createTiltUniformBag({
		u_EmissionGain: { value: emissionGain },
		u_StretchDistortionExponent: { value: stretchDistortionExponent },
		u_NumSides: { value: numSides },
		u_Speed: { value: speed },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Sparks';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const uv = vec2(pow(vUv.x, u.u_StretchDistortionExponent.node), vUv.y);
		const uScale = u.u_Speed.node;
		const t = mod(u.u_time.node.w.mul(uScale), uScale);
		let uCoord: any = uv.x.mul(uScale).sub(t);
		const rowId = floor(uv.y.mul(u.u_NumSides.node));
		const rand = abs(
			fract(sin(rowId.mul(12.9898 + 78.233).mul(2)).mul(50)).add(
				fract(sin(rowId.mul(12.9898 + 78.233).mul(2)).mul(50)),
			),
		).mul(0.75);
		uCoord = uCoord.add(rand.mul(uScale));
		uCoord = mod(uCoord, uScale);
		const vCoord = uv.y.mul(u.u_NumSides.node);
		let tex: any = sampleMain(mainTex, vec2(uCoord, vCoord));
		tex = select(uCoord.lessThan(0), vec4(0, 0, 0, 0), tex);
		tex = select(uCoord.greaterThan(1), vec4(0, 0, 0, 0), tex);
		const bloom = exp(u.u_EmissionGain.node.mul(5)).mul(float(1).sub(vUv.x));
		const color = vColor.mul(tex).mul(bloom);
		return vec4(color.rgb, color.a);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Fairy: procedural tiled dots (preview GLSL; simplified bloom). */
function buildFairy({ emissionGain }: any) {
	const u = createTiltUniformBag({ u_EmissionGain: { value: emissionGain } });
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Fairy';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	const fairyRandom = Fn(([p]) => {
		const r = vec2(23.14079263, 2.7651234);
		return fract(cos(mod(float(123432189), float(1e-7).add(256).mul(dot(p, r)))));
	});

	material.fragmentNode = Fn(() => {
		let st: any = vUv;
		st = vec2(st.x.mul(5), st.y);
		let scaler: any = floor(st);
		scaler = vec2(fairyRandom(scaler), fairyRandom(scaler));
		scaler = scaler.mul(3);
		scaler = max(scaler, vec2(1, 1));
		scaler = floor(scaler);
		st = st.mul(scaler);
		scaler = floor(st);
		scaler = vec2(fairyRandom(scaler.add(vec2(234.4, 0))), fairyRandom(scaler.add(vec2(234.4, 1))));
		scaler = scaler.mul(3);
		scaler = max(scaler, vec2(1, 1));
		scaler = floor(scaler);
		st = st.mul(scaler);
		const rc = floor(st);
		st = fract(st).sub(0.5).mul(2);
		const rscale = mix(0.2, 1, fairyRandom(rc));
		st = st.div(rscale);
		const offset = vec2(fairyRandom(rc.add(vec2(5, 0))), fairyRandom(rc.add(vec2(5, 1)))).mul(0.1);
		st = st.add(offset);
		let lum: any = float(1).sub(length(st));
		lum = lum.sub(max(offset.x, offset.y));
		lum = clamp(lum, float(0), float(1));
		let powpow: any = fairyRandom(rc).mul(2).sub(1);
		powpow = max(0.3, powpow);
		powpow = select(powpow.lessThan(0), float(1).div(abs(powpow)), powpow);
		lum = pow(lum.mul(2), powpow);
		const fadespeed = mix(0.25, 1.25, fairyRandom(rc));
		const fadephase = fairyRandom(rc).mul(6.28318530718);
		const fadeTime = sin(u.u_time.node.z.mul(fadespeed).add(fadephase)).div(2).add(0.5);
		lum = lum.mul(fadeTime);
		const bloomed = vColor.rgb.mul(float(1).add(lum.mul(u.u_EmissionGain.node)));
		return vec4(lum.mul(bloomed), 1);
	})();

	attachUniforms(material, u, {});
	return material;
}

/** Fire2: displace + dual-scroll flames (preview GLSL). */
function buildFire2({
	mainTex,
	displaceTex,
	scroll1,
	scroll2,
	displacementIntensity,
	flameFadeMin,
	flameFadeMax,
}: any) {
	const u = createTiltUniformBag({
		u_Scroll1: { value: scroll1 },
		u_Scroll2: { value: scroll2 },
		u_DisplacementIntensity: { value: displacementIntensity },
		u_FlameFadeMin: { value: flameFadeMin },
		u_FlameFadeMax: { value: flameFadeMax },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_Fire2';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		let displacement = sampleMain(displaceTex, vUv).xy.mul(2).sub(1);
		displacement = displacement.mul(u.u_DisplacementIntensity.node);
		const mask = sampleMain(mainTex, vUv).y;
		const uv = vUv.add(displacement);
		const flame1 = sampleMain(
			mainTex,
			uv.mul(0.7).add(vec2(u.u_time.node.x.mul(u.u_Scroll1.node).negate(), 0)),
		).x;
		const flame2 = sampleMain(
			mainTex,
			vec2(uv.x, float(1).sub(uv.y)).add(
				vec2(
					u.u_time.node.x.mul(u.u_Scroll2.node).negate(),
					u.u_time.node.x.mul(u.u_Scroll2.node).negate().div(4),
				),
			),
		).x;
		let flames: any = clamp(flame2.add(flame1).div(2), float(0), float(1));
		flames = flames.mul(mask);
		flames = mix(float(0), flames, clamp(mask.mul(flames).div(0.8), float(0), float(1)));
		const flameFade = mix(u.u_FlameFadeMin.node, u.u_FlameFadeMax.node, float(0));
		const fade = pow(float(1).sub(vUv.x), flameFade).mul(flameFade.mul(2));
		const tex = vec4(flames, flames, flames, 1).mul(fade);
		const color = vColor.mul(tex);
		return vec4(color.rgb.mul(color.a).mul(15), 1);
	})();

	const textures: Record<string, any> = { u_MainTex: mainTex };
	if (displaceTex) textures.u_DisplaceTex = displaceTex;
	attachUniforms(material, u, textures);
	return material;
}

/** DanceFloor: lifetime pulse quads + tint × MainTex (preview GLSL). */
function buildDanceFloor({ mainTex, tintColor }: any) {
	const u = createTiltUniformBag({
		u_TintColor: { value: tintColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.additive);
	material.name = 'material_DanceFloor';

	const aColor = brushColor();
	const quadIndex = brushQuadIndex();
	const timestamp = brushTimestamp();
	const hash = fract(sin(quadIndex.mul(12.9898)).mul(43758.5453));
	const fakeCreation = timestamp.add(hash.mul(2));
	const lifetime = u.u_time.node.y.sub(fakeCreation);
	const lifeMod = mod(lifetime, float(1));
	const pulse = pow(lifeMod, float(3));
	material.positionNode = brushPositionAttr().add(brushNormalAttr().mul(pulse).mul(0.1));
	const vColor = varying(vec4(aColor.rgb.mul(pulse).mul(2), aColor.a), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');

	material.fragmentNode = Fn(() => {
		const c = vColor.mul(u.u_TintColor.node).mul(sampleMain(mainTex, vUv));
		If(c.a.lessThanEqual(0.01), () => {
			Discard();
		});
		return vec4(c.rgb.mul(c.a), 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** BubbleWand: bulge/curl vertex + thin-film rim diffraction (preview GLSL). */
function buildBubbleWand({
	mainTex,
	scrollRate,
	scrollJitterIntensity,
	scrollJitterFrequency,
}: any) {
	const u = createTiltUniformBag({
		u_ScrollRate: { value: scrollRate },
		u_ScrollJitterIntensity: { value: scrollJitterIntensity },
		u_ScrollJitterFrequency: { value: scrollJitterFrequency },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.normalTransparent);
	material.name = 'material_BubbleWand';

	const displaced = bubbleWandPositionLocal(
		u.u_time.node,
		u.u_ScrollRate.node,
		u.u_ScrollJitterIntensity.node,
		u.u_ScrollJitterFrequency.node,
		u.u_isNewTiltExporter.node,
	);
	material.positionNode = displaced;

	const vColor = varying(brushColor(), 'v_tb_color');
	varying(brushUv2(), 'v_tb_uv'); // keep attribute varying registered
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying(displaced);
	const { ld0 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying(displaced);

	material.fragmentNode = Fn(() => {
		const n = normalize(vNormal);
		const viewDir = normalize(vPos.negate());
		const smoothness = float(0.9);
		const specularColor = vColor.rgb.mul(0.6);
		let rim: any = float(1).sub(abs(dot(viewDir, n)));
		rim = rim.mul(float(1).sub(pow(rim, float(5))));
		const diffraction = sampleMain(
			mainTex,
			vec2(rim.add(u.u_time.node.x).add(n.y), rim.add(n.y)),
		).xyz;
		const emission = rim.mul(
			diffraction.mul(rim).mul(0.25).add(diffraction.mul(vColor.rgb).mul(0.75)),
		);
		const halfVector = normalize(normalize(ld0).add(viewDir));
		const specular = pow(max(dot(n, halfVector), float(0)), smoothness.mul(128));
		let color: any = emission
			.add(specularColor.mul(specular).mul(u.u_SceneLight_0_color.node.rgb))
			.add(vColor.rgb.mul(u.u_ambient_light_color.node.rgb).mul(0.1));
		color = applyFog(color, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(color, vColor.a);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Lacewing: bump + animated SpecTex iridescence + Disney surface (preview GLSL). */
function buildLacewing({
	mainTex,
	bumpMap,
	specTex,
	cutoff,
	shininess,
	specColor,
}: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.alphaTest);
	material.name = 'material_Lacewing';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const { vNormal, vTangent, vBitangent } = viewTBNVaryings();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const mainSample = sampleMain(mainTex, vUv);
		const specSample = texture(specTex, vUv);
		const n = normalize(vNormal);
		const bumped = perturbNormalFacing(vTangent, vBitangent, n, vUv, bumpMap, frontFacing);
		const scroll = u.u_time.node.z;
		const animatedSpec = vec3(
			sin(specSample.x.mul(2).add(scroll.mul(0.5)).sub(vUv.x)).add(1),
			sin(specSample.x.mul(3.3).add(scroll).sub(vUv.x)).add(1),
			sin(specSample.x.mul(4.66).add(scroll.mul(0.25)).sub(vUv.x)).add(1),
		);
		const albedo = mainSample.rgb.mul(vColor.rgb);
		const specularColor = u.u_SpecColor.node.mul(animatedSpec);
		const alpha = mainSample.a.mul(vColor.a);
		const lit = surfaceShaderSpecularGloss(
			bumped,
			normalize(ld0),
			normalize(vPos.negate()),
			u.u_SceneLight_0_color.node.rgb,
			albedo,
			specularColor,
			u.u_Shininess.node,
		)
			.add(
				shShaderWithSpec(
					bumped,
					normalize(ld1),
					u.u_SceneLight_1_color.node.rgb,
					albedo,
					specularColor,
				),
			)
			.add(albedo.mul(u.u_ambient_light_color.node.rgb));
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		If(alpha.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(rgb, alpha);
	})();

	attachUniforms(material, u, {
		u_MainTex: mainTex,
		u_BumpMap: bumpMap,
		u_SpecTex: specTex,
	});
	return material;
}

/** Marbled Rainbow: bump + static SpecTex spec tint + Disney surface (preview GLSL). */
function buildMarbledRainbow({
	mainTex,
	bumpMap,
	specTex,
	cutoff,
	shininess,
	specColor,
}: any) {
	const u = createTiltUniformBag({
		u_Cutoff: { value: cutoff },
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.alphaTest);
	material.name = 'material_Marbled Rainbow';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vUv = varying(brushUv2(), 'v_tb_uv');
	const { vNormal, vTangent, vBitangent } = viewTBNVaryings();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const mainSample = sampleMain(mainTex, vUv);
		const specSample = texture(specTex, vUv);
		const n = normalize(vNormal);
		const bumped = perturbNormalFacing(vTangent, vBitangent, n, vUv, bumpMap, frontFacing);
		const albedo = mainSample.rgb.mul(vColor.rgb);
		const specularColor = u.u_SpecColor.node.mul(specSample.rgb);
		const alpha = mainSample.a.mul(vColor.a);
		const lit = surfaceShaderSpecularGloss(
			bumped,
			normalize(ld0),
			normalize(vPos.negate()),
			u.u_SceneLight_0_color.node.rgb,
			albedo,
			specularColor,
			u.u_Shininess.node,
		)
			.add(
				shShaderWithSpec(
					bumped,
					normalize(ld1),
					u.u_SceneLight_1_color.node.rgb,
					albedo,
					specularColor,
				),
			)
			.add(albedo.mul(u.u_ambient_light_color.node.rgb));
		const rgb = applyFog(lit, fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		If(alpha.lessThanEqual(u.u_Cutoff.node), () => {
			Discard();
		});
		return vec4(rgb, alpha);
	})();

	attachUniforms(material, u, {
		u_MainTex: mainTex,
		u_BumpMap: bumpMap,
		u_SpecTex: specTex,
	});
	return material;
}

/** MylarTube: Disney surface + rim diffraction emission (Unity mix; preview stubbed emission). */
function buildMylarTube({ mainTex, shininess, specColor }: any) {
	const u = createTiltUniformBag({
		u_Shininess: { value: shininess },
		u_SpecColor: { value: specColor },
	});
	const material = new MeshBasicNodeMaterial();
	applyCommonMaterialProps(material, BLEND.opaque);
	material.name = 'material_MylarTube';

	const vColor = varying(brushColor(), 'v_tb_color');
	const vNormal = viewNormalVarying();
	const vPos = viewPositionVarying();
	const { ld0, ld1 } = lightDirVaryings(u);
	const fogCoord = fogCoordVarying();

	material.fragmentNode = Fn(() => {
		const n = normalize(vNormal);
		const viewDir = normalize(vPos.negate());
		const lit = surfaceShaderSpecularGloss(
			n,
			normalize(ld0),
			viewDir,
			u.u_SceneLight_0_color.node.rgb,
			vColor.rgb,
			u.u_SpecColor.node,
			u.u_Shininess.node,
		)
			.add(
				shShaderWithSpec(
					n,
					normalize(ld1),
					u.u_SceneLight_1_color.node.rgb,
					vColor.rgb,
					u.u_SpecColor.node,
				),
			)
			.add(vColor.rgb.mul(u.u_ambient_light_color.node.rgb));
		const N = n.negate();
		const V = normalize(cameraPosition.sub(vPos));
		let rim: any = float(1).sub(abs(dot(V, N)));
		rim = rim.mul(float(1).sub(pow(rim, float(5))));
		const diffraction = sampleMain(
			mainTex,
			vec2(rim.add(u.u_time.node.y).add(N.y), rim.add(N.y)),
		).rgb;
		const emission = rim.mul(
			diffraction.mul(rim).mul(0.25).add(diffraction.mul(vColor.rgb).mul(0.75)),
		);
		const rgb = applyFog(lit.add(emission), fogCoord, u.u_fogColor.node, u.u_fogDensity.node);
		return vec4(rgb, 1);
	})();

	attachUniforms(material, u, { u_MainTex: mainTex });
	return material;
}

/** Rising Bubbles: same as Bubbles (particle + force alpha=1) with distinct material name. */
function buildRisingBubbles(params: any) {
	const material = buildBubbles(params);
	material.name = 'material_Rising Bubbles';
	return material;
}

/**
 * Build a MeshBasicNodeMaterial for a supported Tilt Brush name, or null if unsupported.
 */
export function createNodeBrushMaterial(
	brushName: string,
	textures: Record<string, Texture | null | undefined> = {},
	materialParams: Record<string, any> = {},
): MeshBasicNodeMaterial | null {
	if (!hasNodeBrush(brushName)) {
		return null;
	}

	const mainTex = textures.u_MainTex ?? null;
	const bumpMap = textures.u_BumpMap ?? null;
	const alphaMask = textures.u_AlphaMask ?? null;
	const baseColorTex = textures.u_BaseColorTex ?? textures.u_MainTex ?? null;
	const uniforms = materialParams.uniforms ?? {};

	switch (brushName) {
		case 'Marker':
			return buildCutoffUnlit({
				name: 'Marker',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.067,
				blend: BLEND.opaque,
			});
		case 'TaperedMarker':
			return buildCutoffUnlitNoVertexAlpha({
				name: 'TaperedMarker',
				mainTex,
				cutoff: 0.067,
				blend: BLEND.opaque,
			});
		case 'DoubleTaperedMarker':
			return buildSolidUnlit({
				name: 'DoubleTaperedMarker',
				blend: BLEND.opaque,
				doubleTaper: true,
			});
		case 'DoubleTaperedFlat':
			return buildDoubleTaperedFlat({
				shininess: uniforms.u_Shininess?.value ?? 0.15,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'Wire':
			return buildSolidUnlit({ name: 'Wire', blend: BLEND.opaqueFront });
		case 'Highlighter':
			return buildHighlighter({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.12,
			});
		case 'SoftHighlighter':
			return buildSoftHighlighter({ mainTex });
		case 'Fire':
			return buildFire({
				mainTex,
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5,
			});
		case 'Light':
			return buildLight({
				mainTex,
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.45,
			});
		case 'Comet':
			return buildComet({
				mainTex,
				alphaMask,
				speed: uniforms.u_Speed?.value ?? 1,
				alphaMaskTexelSize:
					uniforms.u_AlphaMask_TexelSize?.value?.clone?.() ??
					uniforms.u_AlphaMask_TexelSize?.value ??
					new Vector4(0.0156, 1, 64, 1),
			});
		case 'Flat':
			return buildDiffuseLit({
				name: 'Flat',
				blend: BLEND.opaqueFront,
			});
		case 'Lofted':
			// Same Lambert/SH lighting as Flat (no textures).
			return buildDiffuseLit({
				name: 'Lofted',
				blend: BLEND.opaqueFront,
			});
		case 'MatteHull':
			return buildDiffuseLit({
				name: 'MatteHull',
				blend: BLEND.opaqueFront,
			});
		case 'ShinyHull':
			return buildShinyHull({
				shininess: uniforms.u_Shininess?.value ?? 0.743,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.1985294, 0.1985294, 0.1985294),
			});
		case 'Spikes':
			// Preview GLSL is Lambert/SH only (no bump/spec in web fragment).
			return buildDiffuseLit({
				name: 'Spikes',
				blend: BLEND.opaqueFront,
			});
		case 'Icing':
			return buildIcing({
				mainTex: mainTex ?? bumpMap,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.15,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'TaperedFlat':
			return buildDiffuseLit({
				name: 'TaperedFlat',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.067,
				blend: BLEND.opaque,
			});
		case 'Splatter':
			// Lambert/SH + MainTex alpha cutoff (Diffuse.glsl a=0.067 preview; sketch cutoff 0.2).
			return buildDiffuseLit({
				name: 'Splatter',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.2,
				blend: BLEND.opaque,
			});
		case 'Waveform':
			return buildWaveform({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5178571,
			});
		case 'Toon':
			return buildToon();
		case 'HyperGrid':
			return buildHyperGrid({
				mainTex,
				tintColor:
					uniforms.u_TintColor?.value?.clone?.() ??
					uniforms.u_TintColor?.value ??
					new Vector4(1, 1, 1, 1),
			});
		case 'Electricity':
			return buildElectricity({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.2,
				displacementIntensity: uniforms.u_DisplacementIntensity?.value ?? 2,
			});
		case 'Ink':
			return buildSurfaceBumpCutoff({
				name: 'Ink',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.4,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.2352941, 0.2352941, 0.2352941),
				// OilPaint-style: no post-bump GLSL flip; inline PerturbNormal facing.
				invertFacing: false,
			});
		case 'InkGeometry':
			return buildSurfaceBumpCutoff({
				name: 'InkGeometry',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.4,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.235294, 0.235294, 0.235294),
				invertFacing: false,
			});
		case 'OilPaint':
			return buildSurfaceBumpCutoff({
				name: 'OilPaint',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.4,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.2352941, 0.2352941, 0.2352941),
				invertFacing: false,
			});
		case 'Paper':
			return buildSurfaceBumpCutoff({
				name: 'Paper',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.16,
				shininess: uniforms.u_Shininess?.value ?? 0.145,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
				invertFacing: false,
			});
		case 'ThickPaint':
			// Match OilPaint: PerturbNormal owns facing; no post-bump lighting flip.
			return buildSurfaceBumpCutoff({
				name: 'ThickPaint',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.4,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.2352941, 0.2352941, 0.2352941),
				invertFacing: false,
			});
		case 'WetPaint':
			// GLSL has no post-bump lighting flip (OilPaint-style).
			return buildSurfaceBumpCutoff({
				name: 'WetPaint',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.3,
				shininess: uniforms.u_Shininess?.value ?? 0.85,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.139706, 0.139706, 0.139706),
				invertFacing: false,
			});
		case 'VelvetInk':
			return buildVelvetInk({ mainTex });
		case 'Rainbow':
			return buildRainbow({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.65,
			});
		case 'ChromaticWave':
			return buildChromaticWave({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.45,
			});
		case 'Hypercolor':
			return buildHypercolor({
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.5,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.2745098, 0.2745098, 0.2745098),
			});
		case 'Disco':
			return buildDisco({
				shininess: uniforms.u_Shininess?.value ?? 0.65,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.5147059, 0.5147059, 0.5147059),
			});
		case 'CoarseBristles':
			return buildDiffuseLit({
				name: 'CoarseBristles',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.25,
				blend: BLEND.alphaTest,
				a2c: true,
			});
		case 'UnlitHull':
			return buildSolidUnlit({ name: 'UnlitHull', blend: BLEND.opaqueFront });
		case 'Smoke':
			return buildSmoke({
				mainTex,
				scrollRate: uniforms.u_ScrollRate?.value ?? 0.75,
			});
		case 'Snow':
			return buildSnow({
				mainTex,
				scrollRate: uniforms.u_ScrollRate?.value ?? 0.2,
				scrollDistance:
					uniforms.u_ScrollDistance?.value?.clone?.() ??
					uniforms.u_ScrollDistance?.value ??
					new Vector3(0, -0.3, 0),
				jitterIntensity: uniforms.u_ScrollJitterIntensity?.value ?? 0.01,
				jitterFrequency: uniforms.u_ScrollJitterFrequency?.value ?? 12,
			});
		case 'Dots':
			return buildDots({
				mainTex,
				emissionGain: uniforms.u_EmissionGain?.value ?? 300,
				baseGain: uniforms.u_BaseGain?.value ?? 0.4,
			});
		case 'Embers':
			return buildEmbers({ mainTex });
		case 'Bubbles':
			return buildBubbles({
				mainTex,
				scrollRate: uniforms.u_ScrollRate?.value ?? 0.5,
				scrollJitterIntensity: uniforms.u_ScrollJitterIntensity?.value ?? 0.02,
				scrollJitterFrequency: uniforms.u_ScrollJitterFrequency?.value ?? 0.2,
			});
		case 'Streamers':
			return buildStreamers({
				mainTex,
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.4,
			});
		case 'Stars':
			return buildStars({
				mainTex,
				sparkleRate: uniforms.u_SparkleRate?.value ?? 5.3,
			});
		case 'Petal':
			return buildPetal({
				shininess: uniforms.u_Shininess?.value ?? 0.01,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'WigglyGraphite':
			return buildWigglyGraphite({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
			});
		case 'CelVinyl':
			return buildCelVinyl({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.554,
			});
		case 'NeonPulse':
			return buildNeonPulse({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5,
			});
		case 'LightWire':
			return buildLightWire({
				shininess: uniforms.u_Shininess?.value ?? 0.81,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.3455882, 0.3455882, 0.3455882),
			});
		case 'DuctTape':
			return buildSurfaceBumpCutoff({
				name: 'DuctTape',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.2,
				shininess: uniforms.u_Shininess?.value ?? 0.414,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.5372549, 0.5372549, 0.5372549),
				invertFacing: false,
			});
		case 'DuctTapeGeometry':
			return buildSurfaceBumpCutoff({
				name: 'DuctTapeGeometry',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.2,
				shininess: uniforms.u_Shininess?.value ?? 0.414,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.5372549, 0.5372549, 0.5372549),
				invertFacing: false,
			});
		case 'Charcoal':
			return buildSurfaceBumpCutoff({
				name: 'Charcoal',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.01,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
				invertFacing: false,
			});
		case 'DryBrush':
			return buildSurfaceBumpCutoff({
				name: 'DryBrush',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.2,
				shininess: uniforms.u_Shininess?.value ?? 0.05,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
				invertFacing: false,
			});
		case 'DiamondHull':
			return buildDiamondHull({ mainTex });
		case 'BlocksBasic':
			return buildBlocksBasic({
				shininess: uniforms.u_Shininess?.value ?? 0.2,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.1960784, 0.1960784, 0.1960784),
			});
		case 'BlocksGlass':
			return buildBlocksGlass({
				shininess: uniforms.u_Shininess?.value ?? 0.8,
				rimIntensity: uniforms.u_RimIntensity?.value ?? 0.7,
				rimPower: uniforms.u_RimPower?.value ?? 4,
				color:
					uniforms.u_Color?.value?.clone?.() ??
					uniforms.u_Color?.value ??
					new Vector4(1, 1, 1, 1),
			});
		case 'BlocksGem':
			return buildBlocksGem({
				shininess: uniforms.u_Shininess?.value ?? 0.9,
				rimIntensity: uniforms.u_RimIntensity?.value ?? 0.5,
				rimPower: uniforms.u_RimPower?.value ?? 2,
				frequency: uniforms.u_Frequency?.value ?? 2,
				jitter: uniforms.u_Jitter?.value ?? 1,
				color:
					uniforms.u_Color?.value?.clone?.() ??
					uniforms.u_Color?.value ??
					new Vector4(1, 1, 1, 1),
			});
		case 'PbrTemplate':
			return buildPbrTemplate({
				baseColorTex,
				metallicFactor: uniforms.u_MetallicFactor?.value ?? 0,
				roughnessFactor: uniforms.u_RoughnessFactor?.value ?? 1,
				baseColorFactor:
					uniforms.u_BaseColorFactor?.value?.clone?.() ??
					uniforms.u_BaseColorFactor?.value ??
					new Vector4(1, 1, 1, 1),
			});
		case 'PbrTransparentTemplate':
			return buildPbrTransparentTemplate({
				baseColorTex,
				metallicFactor: uniforms.u_MetallicFactor?.value ?? 0,
				roughnessFactor: uniforms.u_RoughnessFactor?.value ?? 1,
				baseColorFactor:
					uniforms.u_BaseColorFactor?.value?.clone?.() ??
					uniforms.u_BaseColorFactor?.value ??
					new Vector4(1, 1, 1, 1),
				cutoff: uniforms.u_Cutoff?.value ?? 0.01,
			});
		case 'Taffy':
			// Unlit.glsl + MainTex.a cutoff (TB_ALPHA_CUTOFF 0.5); no vertex-alpha mask.
			return buildCutoffUnlitNoVertexAlpha({
				name: 'Taffy',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				blend: BLEND.opaque,
			});
		case 'Leaves':
			return buildLeaves({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.395,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'Leaves2':
			return buildSurfaceBumpCutoff({
				name: 'Leaves2',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.395,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'Gouache':
			return buildSurfaceBumpCutoff({
				name: 'Gouache',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.01,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'Muscle':
			return buildSurfaceBumpCutoff({
				name: 'Muscle',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.3,
				shininess: uniforms.u_Shininess?.value ?? 0.57,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.0808824, 0.0808824, 0.0808824),
			});
		case 'Guts':
			return buildSurfaceBumpCutoff({
				name: 'Guts',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.3,
				shininess: uniforms.u_Shininess?.value ?? 0.743,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.237457, 0.257941, 0.264706),
				invertFacing: false,
			});
		case 'KeijiroTube':
			return buildSurfaceBumpCutoff({
				name: 'KeijiroTube',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.432,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.757353, 0.757353, 0.757353),
			});
		case 'TaperedWire':
			return buildSurfaceBumpCutoff({
				name: 'TaperedWire',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.1,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.0955882, 0.0955882, 0.0955882),
			});
		case 'PassthroughHull':
			return buildSurfaceBumpCutoff({
				name: 'PassthroughHull',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.574,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.294118, 0.294118, 0.294118),
			});
		case 'SvgTemplate':
			return buildSurfaceBumpCutoff({
				name: 'SvgTemplate',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.2,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.1960784, 0.1960784, 0.1960784),
			});
		case 'Plasma':
			return buildPlasma({
				mainTex,
				mainTexST:
					uniforms.u_MainTex_ST?.value?.clone?.() ??
					uniforms.u_MainTex_ST?.value ??
					new Vector4(0.5, 1, 0, 0),
			});
		case 'ThickGeometry':
			// OilPaint-style bump; preview GLSL has no MainTex alpha cutoff.
			return buildSurfaceBumpCutoff({
				name: 'ThickGeometry',
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.2,
				shininess: uniforms.u_Shininess?.value ?? 0.414,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.5372549, 0.5372549, 0.5372549),
				invertFacing: false,
				blend: BLEND.opaqueFront,
				useCutoff: false,
			});
		case 'ConcaveHull':
			return buildDisneyCutoff({
				name: 'ConcaveHull',
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.414,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.5372549, 0.5372549, 0.5372549),
				maskVertexAlpha: true,
			});
		case 'SmoothHull':
			// Preview GLSL ignores cutoff despite u_Cutoff in template.
			return buildShinyHull({
				name: 'SmoothHull',
				shininess: uniforms.u_Shininess?.value ?? 0.574,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.294118, 0.294118, 0.294118),
			});
		case 'SquarePaper':
			// Bump code commented out in preview GLSL — Disney surface, no bump.
			return buildShinyHull({
				name: 'SquarePaper',
				shininess: uniforms.u_Shininess?.value ?? 0.145,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0, 0, 0),
			});
		case 'SingleSided':
			// Lambert/SH + fog; preview fragment ignores MainTex (vertex color only).
			return buildDiffuseLit({
				name: 'SingleSided',
				blend: BLEND.opaqueFront,
			});
		case 'DoubleFlat':
			return buildDiffuseLit({
				name: 'DoubleFlat',
				blend: BLEND.opaqueFront,
			});
		case 'TaperedMarker_Flat':
			// Diffuse.glsl TB_ALPHA_CUTOFF 0.5 (uniform u_Cutoff unused in preview).
			return buildDiffuseLit({
				name: 'TaperedMarker_Flat',
				mainTex,
				cutoff: 0.5,
				blend: BLEND.opaque,
			});
		case 'LeakyPen':
			return buildLeakyPen({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				mainTexST:
					uniforms.u_MainTex_ST?.value?.clone?.() ??
					uniforms.u_MainTex_ST?.value ??
					new Vector4(1, 1, 0, 0),
			});
		case 'Lofted (Hue Shift)':
			return buildLoftedHueShift({ mainTex });
		case 'DotMarker':
			return buildCutoffUnlitNoVertexAlpha({
				name: 'DotMarker',
				mainTex,
				cutoff: 0.5,
				blend: BLEND.opaque,
			});
		case 'QuillCube':
			return quillParams('QuillCube', uniforms);
		case 'QuillCylinder':
			return quillParams('QuillCylinder', uniforms);
		case 'QuillEllipse':
			return quillParams('QuillEllipse', uniforms);
		case 'QuillRibbon':
			return quillParams('QuillRibbon', uniforms);
		case 'Wireframe':
			return buildWireframe();
		case 'FacetedTube':
			return buildFacetedTube({
				colorX:
					uniforms.u_ColorX?.value?.clone?.() ??
					uniforms.u_ColorX?.value ??
					new Vector4(1, 0, 0, 1),
				colorY:
					uniforms.u_ColorY?.value?.clone?.() ??
					uniforms.u_ColorY?.value ??
					new Vector4(0, 1, 0, 1),
				colorZ:
					uniforms.u_ColorZ?.value?.clone?.() ??
					uniforms.u_ColorZ?.value ??
					new Vector4(0, 0, 1, 1),
			});
		case 'TubeToonInverted':
			return buildSolidUnlit({ name: 'TubeToonInverted', blend: BLEND.opaqueFront });
		case 'TaperedHueShift':
			return buildTaperedHueShift({
				mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
			});
		case 'Feather':
			return buildUnlitMask({
				name: 'Feather',
				mainTex,
				blend: BLEND.normalTransparent,
			});
		case 'TubeAdditive':
			return buildUnlitMask({
				name: 'TubeAdditive',
				mainTex,
				blend: { ...BLEND.normalTransparent, side: FrontSide },
			});
		case 'Wire (Lit)':
			return buildDiffuseLit({
				name: 'Wire (Lit)',
				blend: BLEND.opaqueFront,
			});
		case '3D Printing Brush':
			return build3DPrinting();
		case 'Wind':
			return buildWind({
				mainTex,
				speed: uniforms.u_Speed?.value ?? 1,
			});
		case 'Drafting':
			return buildDrafting({
				mainTex,
				opacity: uniforms.u_Opacity?.value ?? 1,
			});
		case 'Rain':
			return buildRain({
				mainTex,
				numSides: uniforms.u_NumSides?.value ?? 6,
				speed: uniforms.u_Speed?.value ?? 1,
				mainTexST:
					uniforms.u_MainTex_ST?.value?.clone?.() ??
					uniforms.u_MainTex_ST?.value ??
					new Vector4(4, 1, 0, 0),
			});
		case 'WaveformFFT':
			return buildWaveformFFT({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5178571,
			});
		case 'WaveformTube':
			return buildWaveformTube({ mainTex });
		case 'WaveformParticles':
			return buildWaveformParticles({
				mainTex,
				opacity: uniforms.u_Opacity?.value ?? 1,
			});
		case 'Space':
			return buildSpace({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5,
			});
		case 'Sparks':
			return buildSparks({
				mainTex,
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.723,
				stretchDistortionExponent: uniforms.u_StretchDistortionExponent?.value ?? 1,
				numSides: uniforms.u_NumSides?.value ?? 4,
				speed: uniforms.u_Speed?.value ?? 1,
			});
		case 'Fairy':
			return buildFairy({
				emissionGain: uniforms.u_EmissionGain?.value ?? 0.5,
			});
		case 'Fire2': {
			const displaceTex = textures.u_DisplaceTex ?? null;
			return buildFire2({
				mainTex,
				displaceTex,
				scroll1: uniforms.u_Scroll1?.value ?? 15,
				scroll2: uniforms.u_Scroll2?.value ?? 8,
				displacementIntensity: uniforms.u_DisplacementIntensity?.value ?? 0.04,
				flameFadeMin: uniforms.u_FlameFadeMin?.value ?? 8.53,
				flameFadeMax: uniforms.u_FlameFadeMax?.value ?? 30,
			});
		}
		case 'DanceFloor':
			return buildDanceFloor({
				mainTex,
				tintColor:
					uniforms.u_TintColor?.value?.clone?.() ??
					uniforms.u_TintColor?.value ??
					new Vector4(1, 1, 1, 1),
			});
		case 'BubbleWand':
			return buildBubbleWand({
				mainTex,
				scrollRate: uniforms.u_ScrollRate?.value ?? -0.54,
				scrollJitterIntensity: uniforms.u_ScrollJitterIntensity?.value ?? 3,
				scrollJitterFrequency: uniforms.u_ScrollJitterFrequency?.value ?? 1,
			});
		case 'Lacewing':
			return buildLacewing({
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				specTex: textures.u_SpecTex ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.68,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.75, 0.75, 0.75),
			});
		case 'Marbled Rainbow':
			return buildMarbledRainbow({
				mainTex,
				bumpMap: bumpMap ?? mainTex,
				specTex: textures.u_SpecTex ?? mainTex,
				cutoff: uniforms.u_Cutoff?.value ?? 0.5,
				shininess: uniforms.u_Shininess?.value ?? 0.8,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.220588, 0.220588, 0.220588),
			});
		case 'MylarTube':
			return buildMylarTube({
				mainTex,
				shininess: uniforms.u_Shininess?.value ?? 0.68,
				specColor:
					uniforms.u_SpecColor?.value?.clone?.() ??
					uniforms.u_SpecColor?.value ??
					new Vector3(0.75, 0.75, 0.75),
			});
		case 'Rising Bubbles':
			return buildRisingBubbles({
				mainTex,
				scrollRate: uniforms.u_ScrollRate?.value ?? 0.5,
				scrollJitterIntensity: uniforms.u_ScrollJitterIntensity?.value ?? 0.02,
				scrollJitterFrequency: uniforms.u_ScrollJitterFrequency?.value ?? 0.2,
			});
		default:
			return null;
	}
}

export { hasNodeBrush, NODE_BRUSH_NAMES } from './brushCommon.js';
