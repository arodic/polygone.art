// Copyright 2021-2022 Icosa Gallery
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

import * as THREE from 'three';

import { TiltShaderLoader } from './TiltShaderLoader.js';
import { createNodeBrushMaterial } from './brushMaterials.js';

type GltfParser = {
    json: any;
    options: { manager: THREE.LoadingManager };
    associations: WeakMap<object, any>;
};

type BrushFlags = { lights?: boolean; fog?: boolean };

/** Brush meshes always carry a single dynamic material with uniforms. */
type BrushMesh = THREE.Mesh & { material: any };

export class GLTFGoogleTiltBrushMaterialExtension {
    name: string;
    altName: string;
    parser: GltfParser;
    brushPath: string;
    isLegacy: boolean;
    tiltShaderLoader: TiltShaderLoader;
    timer: THREE.Timer;

    constructor(parser: GltfParser, brushPath: string, isLegacy = false) {
        this.name = "GOOGLE_tilt_brush_material";
        this.altName = "GOOGLE_tilt_brush_techniques";
        this.parser = parser;
        this.brushPath = brushPath;
        this.isLegacy = isLegacy;

        // Quick repair of path if required
        if (this.brushPath.slice(this.brushPath.length - 1) !== "/") {
            this.brushPath += "/";
        }

        this.tiltShaderLoader = new TiltShaderLoader(parser.options.manager);
        this.tiltShaderLoader.setPath(this.brushPath);
        this.timer = new THREE.Timer();
    }

    /**
     * NodeMaterials bake Tilt Brush fog in TSL; disable Three.js scene fog.
     */
    applyLoadedBrushFlags(shader: any, { lights: _lights = true, fog: _fog = true }: BrushFlags = {}) {
        if (!shader) return shader;
        shader.fog = false;
        shader.uniformsNeedUpdate = true;
        return shader;
    }

    beforeRoot(): void {
        const parser = this.parser;
        const json = parser.json;
        let isTilt = this.isTiltGltf(json);
        if (!isTilt) {
            console.warn("Not Tilt Brush Extensions found", json);
            // return null;
        }

        json.materials.forEach((material: any) => {

            const extensionsDef = material.extensions;

            let nameOrGuid;
            // Try a guid first
            if (extensionsDef?.[this.name]) {
                nameOrGuid = extensionsDef[this.name].guid;
            }
            else if (material.name?.startsWith("material_")) {
                nameOrGuid = material.name.replace('material_', '');
            } else if (material.name?.startsWith('ob-')) {
                nameOrGuid = material.name.replace('ob-', '');
            }
            else if (material.name !== undefined) {
                let newName = this.tryReplaceBlocksName(material.name);
                if (newName !== undefined) {
                    nameOrGuid = newName;
                }
            }

            const materialName = this.tiltShaderLoader.lookupMaterialName(nameOrGuid);
            const materialParams = this.tiltShaderLoader.lookupMaterialParams(materialName);

            if (!materialParams) {
                console.warn(`No material params found: ${nameOrGuid} (${materialName})`);
                return;
            }

            // MainTex
            if(material?.pbrMetallicRoughness?.baseColorTexture && materialParams.uniforms?.u_MainTex) {
                const mainTex = json.images[material.pbrMetallicRoughness.baseColorTexture.index];
                mainTex.uri = this.brushPath + materialParams.uniforms?.u_MainTex.value;
            }

            // BumpMap
            if(material?.normalTexture && materialParams.uniforms?.u_BumpMap) {
                const bumpMap = json.images[material.normalTexture.index];
                bumpMap.uri = this.brushPath + materialParams.uniforms.u_BumpMap.value;
            }
        });
    }

    afterRoot(glTF: any): Promise<any[]> {
        const parser = this.parser;
        const json = parser.json;
        // if (!this.isTiltGltf(json)) {
        //     return null;
        // }

        // Detect exporter type and store on scenes
        const generator = json.asset?.generator;
        const isNewTiltExporter = generator && generator.includes('Open Brush UnityGLTF Exporter');

        const shaderResolves: Promise<void>[] = [];

        for(const scene of glTF.scenes) {
            scene.userData.isNewTiltExporter = isNewTiltExporter;
            scene.traverse(async (object: any) => {
                const association = parser.associations.get(object);

                if (association === undefined || association.meshes === undefined) {
                    return;
                }

                const mesh = json.meshes[association.meshes];
                mesh.primitives.forEach((prim: any) => {
                    if(prim.material === null || prim.material === undefined) {
                        return;
                    }

                    const material = json.materials[prim.material];

                    const extensionsDef = material.extensions;

                    let brushName;
                    if (material.name?.startsWith('ob-')) {
                        // New glb naming convention
                        brushName = material.name.replace('ob-', '');
                    }
                    else if (material.name?.startsWith('material_')) {
                        // Some legacy poly files
                        // TODO - risk of name collision with non-tilt materials
                        // Maybe we should pass in a flag when a tilt gltf is detected?
                        // Do names in this format use guids or english names?
                        brushName = material.name.replace('material_', '');
                    } else if (extensionsDef) {
                        let exDef = extensionsDef[this.name];
                        if (exDef !== undefined) {
                            brushName = exDef.guid;
                        }
                    }

                    let newName = this.tryReplaceBlocksName(material.name);
                    if (newName !== undefined) {
                        brushName = newName;
                    }

                    if (brushName !== undefined) {
                        shaderResolves.push(this.replaceMaterial(object, brushName, isNewTiltExporter));
                    } else {
                        console.warn("No brush name found for material", material.name, brushName);
                    }
                });
            });
        }

        return Promise.all(shaderResolves);
    }

    tryReplaceBlocksName(originalName: string | undefined): string | undefined {
        if (originalName === undefined) return;
        // Handle naming embedded models exported from newer Open Brush versions
        let newName;
        if (originalName.includes('_BlocksPaper ')) {
            newName = ('BlocksPaper');
        } else if (originalName.includes('_BlocksGlass ')) {
            newName = ('BlocksGlass');
        } else if (originalName.includes('_BlocksGem ')) {
            newName = ('BlocksGem');
        }
        return newName;
    }

    isTiltGltf(json: any): boolean {
        let isTiltGltf = false;
        isTiltGltf ||= (json.extensionsUsed && json.extensionsUsed.includes(this.name));
        isTiltGltf ||= (json.extensionsUsed && json.extensionsUsed.includes(this.altName));
        isTiltGltf ||= ('extensions' in json && this.name in json['extensions']);
        isTiltGltf ||= ('extensions' in json && this.altName in json['extensions']);
        return isTiltGltf;
    }

    async replaceMaterial(mesh: BrushMesh, guidOrName: string, isNewTiltExporter = false): Promise<void> {

        const renameAttribute = (mesh: BrushMesh, oldName: string, newName: string) => {
            const attr = mesh.geometry.getAttribute(oldName);
            if (attr) {
                mesh.geometry.setAttribute(newName, attr);
                mesh.geometry.deleteAttribute(oldName);
            }
        };

        // Imported Poly models use per-instance PbrTemplate GUIDs (not the template GUID).
        // Detect via LegacyGLTF uniforms / map so we still replace under WebGPU.
        const prevUniforms = mesh.material?.uniforms ?? mesh.material?.userData?.tiltGltfUniforms;
        const prevMap = mesh.material?.map;
        let resolvedName = this.tiltShaderLoader.lookupMaterialName(guidOrName);
        const hasPbrUniforms =
            (prevUniforms?.u_BaseColorTex && prevUniforms?.u_MetallicFactor !== undefined) ||
            (prevMap?.isTexture && prevUniforms?.u_RoughnessFactor !== undefined) ||
            (prevMap?.isTexture && /BaseColor|baseColor/i.test(prevMap.name || prevMap.image?.src || ''));
        const isTransparentPbr =
            /PbrTransparentTemplate/i.test(mesh.material?.fragmentShader || '') ||
            /PbrTransparentTemplate/i.test(mesh.material?.vertexShader || '');
        if (resolvedName == null && hasPbrUniforms) {
            resolvedName = isTransparentPbr ? 'PbrTransparentTemplate' : 'PbrTemplate';
        }
        if (resolvedName) {
            guidOrName = resolvedName;
        }


        const loadPbrTemplateMaterial = async () => {
            const gltfUniforms = prevUniforms ?? mesh.material?.userData?.tiltGltfUniforms;
            const baseColorTex =
                gltfUniforms?.u_BaseColorTex?.value?.isTexture
                    ? gltfUniforms.u_BaseColorTex.value
                    : prevMap?.isTexture
                      ? prevMap
                      : null;
            if (!baseColorTex) {
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] PbrTemplate: no BaseColorTex; keeping existing material');
                return null;
            }
            const template = this.tiltShaderLoader.lookupMaterialParams('PbrTemplate');
            if (!template) {
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] PbrTemplate: missing material params');
                return null;
            }
            const materialParams = {
                ...template,
                uniforms: { ...template.uniforms },
            };
            for (const key of Object.keys(materialParams.uniforms)) {
                const entry = template.uniforms[key];
                materialParams.uniforms[key] = { value: entry?.value?.clone?.() ?? entry?.value };
            }
            const overrideKeys = [
                'u_MetallicFactor',
                'u_RoughnessFactor',
                'u_BaseColorFactor',
                'u_ambient_light_color',
                'u_SceneLight_0_color',
                'u_SceneLight_1_color',
            ];
            for (const key of overrideKeys) {
                if (gltfUniforms?.[key]?.value === undefined) continue;
                const src = gltfUniforms[key].value;
                if (materialParams.uniforms[key]?.value?.copy && src?.copy) {
                    materialParams.uniforms[key].value.copy(src);
                } else if (typeof src === 'number') {
                    materialParams.uniforms[key] = { value: src };
                } else if (Array.isArray(src)) {
                    const dst = materialParams.uniforms[key]?.value;
                    if (dst?.fromArray) dst.fromArray(src);
                    else if (dst?.set) dst.set(...src);
                    else materialParams.uniforms[key] = { value: src };
                } else {
                    materialParams.uniforms[key] = { value: src };
                }
            }
            return createNodeBrushMaterial(
                'PbrTemplate',
                { u_BaseColorTex: baseColorTex },
                materialParams,
            );
        };

        const loadPbrTransparentTemplateMaterial = async () => {
            const gltfUniforms = prevUniforms ?? mesh.material?.userData?.tiltGltfUniforms;
            const baseColorTex =
                gltfUniforms?.u_BaseColorTex?.value?.isTexture
                    ? gltfUniforms.u_BaseColorTex.value
                    : prevMap?.isTexture
                      ? prevMap
                      : null;
            if (!baseColorTex) {
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] PbrTransparentTemplate: no BaseColorTex; keeping existing material');
                return null;
            }
            const template = this.tiltShaderLoader.lookupMaterialParams('PbrTransparentTemplate');
            if (!template) {
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] PbrTransparentTemplate: missing material params');
                return null;
            }
            const materialParams = {
                ...template,
                uniforms: { ...template.uniforms },
            };
            for (const key of Object.keys(materialParams.uniforms)) {
                const entry = template.uniforms[key];
                materialParams.uniforms[key] = { value: entry?.value?.clone?.() ?? entry?.value };
            }
            const overrideKeys = [
                'u_MetallicFactor',
                'u_RoughnessFactor',
                'u_BaseColorFactor',
                'u_Cutoff',
                'u_ambient_light_color',
                'u_SceneLight_0_color',
                'u_SceneLight_1_color',
            ];
            for (const key of overrideKeys) {
                if (gltfUniforms?.[key]?.value === undefined) continue;
                const src = gltfUniforms[key].value;
                if (materialParams.uniforms[key]?.value?.copy && src?.copy) {
                    materialParams.uniforms[key].value.copy(src);
                } else if (typeof src === 'number') {
                    materialParams.uniforms[key] = { value: src };
                } else if (Array.isArray(src)) {
                    const dst = materialParams.uniforms[key]?.value;
                    if (dst?.fromArray) dst.fromArray(src);
                    else if (dst?.set) dst.set(...src);
                    else materialParams.uniforms[key] = { value: src };
                } else {
                    materialParams.uniforms[key] = { value: src };
                }
            }
            return createNodeBrushMaterial(
                'PbrTransparentTemplate',
                { u_BaseColorTex: baseColorTex },
                materialParams,
            );
        };

        const setAttributeIfExists = (mesh: BrushMesh, oldName: string, newName: string, { warn = true }: { warn?: boolean } = {}) => {
            const srcAttr = mesh.geometry.getAttribute(oldName);
            if (srcAttr) {
                // Avoid overwriting an attribute that may carry extended components (e.g., radius in texcoord.z)
                if (!mesh.geometry.getAttribute(newName)) {
                    mesh.geometry.setAttribute(newName, srcAttr);
                } else {
                    // Keep the first-mapped attribute; skip overwriting to preserve itemSize/data
                    // console.debug(`Skipping overwrite of ${newName}; ${oldName} present on ${mesh.name}`);
                }
            } else if (warn) {
                console.warn(`Attribute ${oldName} not found in mesh ${mesh.name}`);
            }
        }

        // GLSL/Node Disco always reads a_texcoord1 (baked radius on new exporter).
        // Legacy sketches only ship TEXCOORD_0 (radius in .z) — provide zeros so binding succeeds.
        const ensureDiscoTexcoord1 = (mesh: BrushMesh) => {
            if (mesh.geometry.getAttribute('a_texcoord1')) return;
            const pos = mesh.geometry.getAttribute('a_position')
                || mesh.geometry.getAttribute('position');
            if (!pos) return;
            mesh.geometry.setAttribute(
                'a_texcoord1',
                new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3),
            );
        };

        // Blocks / Poly meshes often omit TANGENT. DefaultVS still declares a_tangent;
        // BlocksGem/Glass never sample TBN — install (1,0,0,1) so normalize() is safe.
        const ensureTangentAttribute = (mesh: BrushMesh) => {
            if (mesh.geometry.getAttribute('a_tangent')) return;
            const pos = mesh.geometry.getAttribute('a_position')
                || mesh.geometry.getAttribute('position');
            if (!pos) return;
            const data = new Float32Array(pos.count * 4);
            for (let i = 0; i < pos.count; i++) {
                data[i * 4] = 1;
                data[i * 4 + 3] = 1;
            }
            mesh.geometry.setAttribute('a_tangent', new THREE.BufferAttribute(data, 4));
        };

        // Bake corner index matching GLSL `gl_VertexID % 4` (buffer index, not draw order).
        // Needed for WebGPU Node billboards: WGSL vertex_index is draw-call order, and
        // atlas UVs (e.g. Smoke 0.5–1 tiles) are not reliable 0/1 corner markers.
        const ensureParticleCornerAttribute = (mesh: BrushMesh) => {
            if (mesh.geometry.getAttribute('a_corner')) return;
            const pos = mesh.geometry.getAttribute('a_position')
                || mesh.geometry.getAttribute('position');
            if (!pos) return;
            const corners = new Float32Array(pos.count);
            for (let i = 0; i < pos.count; i++) corners[i] = i % 4;
            mesh.geometry.setAttribute('a_corner', new THREE.BufferAttribute(corners, 1));
        };

        // Bake quad index matching GLSL `gl_VertexID / 4` (DanceFloor per-quad hash).
        const ensureQuadIndexAttribute = (mesh: BrushMesh) => {
            if (mesh.geometry.getAttribute('a_quad')) return;
            const pos = mesh.geometry.getAttribute('a_position')
                || mesh.geometry.getAttribute('position');
            if (!pos) return;
            const quads = new Float32Array(pos.count);
            for (let i = 0; i < pos.count; i++) quads[i] = Math.floor(i / 4);
            mesh.geometry.setAttribute('a_quad', new THREE.BufferAttribute(quads, 1));
        };

        const ensureTimestampAttribute = (mesh: BrushMesh) => {
            if (mesh.geometry.getAttribute('a_timestamp')) return;
            const pos = mesh.geometry.getAttribute('a_position')
                || mesh.geometry.getAttribute('position');
            if (!pos) return;
            mesh.geometry.setAttribute(
                'a_timestamp',
                new THREE.BufferAttribute(new Float32Array(pos.count), 1),
            );
        };

        const copyFixColorAttribute = (mesh: BrushMesh) => {

            function linearToSRGB(x: number): number {
                return x <= 0.0031308
                    ? x * 12.92
                    : 1.055 * Math.pow(x, 1.0 / 2.4) - 0.055;
            }

            let colorAttribute = mesh.geometry.getAttribute("color");
            if (colorAttribute) {
                if (colorAttribute.array instanceof Float32Array) {
                    const src = colorAttribute.array;
                    const itemSize = colorAttribute.itemSize;
                    const count = src.length / itemSize;
                    const normalizedColors = new Uint8Array(src.length);

                    // Apply color space conversion only for non-legacy files
                    // Legacy files already have sRGB colors, non-legacy files need linear->sRGB conversion
                    const shouldConvert = !this.isLegacy;

                    for (let i = 0; i < count; ++i) {
                        if (shouldConvert) {
                            normalizedColors[i * itemSize + 0] = Math.round(linearToSRGB(src[i * itemSize + 0]) * 255); // R
                            normalizedColors[i * itemSize + 1] = Math.round(linearToSRGB(src[i * itemSize + 1]) * 255); // G
                            normalizedColors[i * itemSize + 2] = Math.round(linearToSRGB(src[i * itemSize + 2]) * 255); // B
                        } else {
                            // Legacy files: colors are already sRGB, just scale to 0-255
                            normalizedColors[i * itemSize + 0] = Math.round(src[i * itemSize + 0] * 255); // R
                            normalizedColors[i * itemSize + 1] = Math.round(src[i * itemSize + 1] * 255); // G
                            normalizedColors[i * itemSize + 2] = Math.round(src[i * itemSize + 2] * 255); // B
                        }
                        if (itemSize > 3) {
                            normalizedColors[i * itemSize + 3] = Math.round(src[i * itemSize + 3] * 255); // A (linear)
                        }
                    }
                    colorAttribute = new THREE.BufferAttribute(normalizedColors, itemSize, true);
                    mesh.geometry.setAttribute("a_color", colorAttribute);
                }
                else
                {
                    mesh.geometry.setAttribute("a_color", mesh.geometry.getAttribute("color"));
                }
            }
        }

        let shader;

        switch(guidOrName) {
            case "0e87b49c-6546-3a34-3a44-8a556d7d6c3e":
            case "BlocksBasic":
            case "BlocksPaper":
                mesh.geometry.name = "geometry_BlocksBasic";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                //setAttributeIfExistsdmes "uvh,, 0", mesh.);
                shader = await this.tiltShaderLoader.loadAsync("BlocksBasic");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_BlocksBasic";
                break;
            case "232998f8-d357-47a2-993a-53415df9be10":
            case "BlocksGem":
                mesh.geometry.name = "geometry_BlocksGem";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent", { warn: false });
                ensureTangentAttribute(mesh);
                copyFixColorAttribute(mesh);
                //setAttributeIfExistsdmes "uvh,, 0", mesh.);
                shader = await this.tiltShaderLoader.loadAsync("BlocksGem");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_BlocksGem";
                break;
            case "3d813d82-5839-4450-8ddc-8e889ecd96c7":
            case "BlocksGlass":
                mesh.geometry.name = "geometry_BlocksGlass";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent", { warn: false });
                ensureTangentAttribute(mesh);
                copyFixColorAttribute(mesh);
                //setAttributeIfExistsdmes "uvh,, 0", mesh.);
                shader = await this.tiltShaderLoader.loadAsync("BlocksGlass");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_BlocksGlass";
                break;

            case "89d104cd-d012-426b-b5b3-bbaee63ac43c":
            case "Bubbles":
                mesh.geometry.name = "geometry_Bubbles";

                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);

                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Bubbles");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Bubbles";
                break;

            case "700f3aa8-9a7c-2384-8b8a-ea028905dd8c":
            case "CelVinyl":
                mesh.geometry.name = "geometry_CelVinyl";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("CelVinyl");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_CelVinyl";
                break;

            case "0f0ff7b2-a677-45eb-a7d6-0cd7206f4816":
            case "ChromaticWave":
                mesh.geometry.name = "geometry_ChromaticWave";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("ChromaticWave");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_ChromaticWave";
                break;

            case "1161af82-50cf-47db-9706-0c3576d43c43":
            case "79168f10-6961-464a-8be1-57ed364c5600":
            case "CoarseBristles":
                mesh.geometry.name = "geometry_CoarseBristles";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("CoarseBristles");
                shader.alphaToCoverage = true;
                shader.alphaTest = 0.5;
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_CoarseBristles";
                break;

            case "1caa6d7d-f015-3f54-3a4b-8b5354d39f81":
            case "Comet":
                mesh.geometry.name = "geometry_Comet";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Comet");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Comet";
                break;

            case "c8313697-2563-47fc-832e-290f4c04b901":
            case "DiamondHull":
                mesh.geometry.name = "geometry_DiamondHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("DiamondHull");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_DiamondHull";
                break;

            case "4391aaaa-df73-4396-9e33-31e4e4930b27":
            case "Disco":
                mesh.geometry.name = "geometry_Disco";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                // Optional: LegacyGLTF has no TEXCOORD_1; new exporter may bake radius into UV1.
                setAttributeIfExists(mesh, "uv1", "a_texcoord1", { warn: false });
                setAttributeIfExists(mesh, "uv2", "a_texcoord1", { warn: false });
                setAttributeIfExists(mesh, "uv3", "a_texcoord1", { warn: false });
                ensureDiscoTexcoord1(mesh);

                if (isNewTiltExporter) {
                    const uv0 = mesh.geometry.getAttribute("a_texcoord0");
                    const uv1 = mesh.geometry.getAttribute("a_texcoord1");
                    const uv0HasRadius = uv0 && uv0.itemSize >= 3;
                    // Zero-filled fallback does not count as baked radius.
                    const uv1HasBakedRadius = uv1 && uv1.itemSize >= 1 && (() => {
                        const arr = uv1.array;
                        for (let i = 0; i < arr.length; i += uv1.itemSize) {
                            if (Math.abs(arr[i]) > 1e-6) return true;
                        }
                        return false;
                    })();
                    if (!uv0HasRadius && !uv1HasBakedRadius) {
                        console.warn(
                            "Disco brush is missing radius data (need texcoord0.z or baked texcoord1.x). " +
                            "New exporter GLB likely lacks UV bake output.",
                            mesh.name
                        );
                    }
                }

                shader = await this.tiltShaderLoader.loadAsync("Disco");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Disco";
                break;

            case "d1d991f2-e7a0-4cf1-b328-f57e915e6260":
            case "DotMarker":
                mesh.geometry.name = "geometry_DotMarker";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("DotMarker");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_DotMarker";
                break;

            case "6a1cf9f9-032c-45ec-9b1d-a6680bee30f7":
            case "Dots":
                mesh.geometry.name = "geometry_Dots";

                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Dots");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Dots";
                break;

            case "0d3889f3-3ede-470c-8af4-f44813306126":
            case "DoubleTaperedFlat":
                mesh.geometry.name = "geometry_DoubleTaperedFlat";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("DoubleTaperedFlat");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_DoubleTaperedFlat";
                break;

            case "0d3889f3-3ede-470c-8af4-de4813306126":
            case "DoubleTaperedMarker":
                mesh.geometry.name = "geometry_DoubleTaperedMarker";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("DoubleTaperedMarker");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_DoubleTaperedMarker";
                break;

            case "d0262945-853c-4481-9cbd-88586bed93cb":
            case "3ca16e2f-bdcd-4da2-8631-dcef342f40f1":
            case "DuctTape":
                mesh.geometry.name = "geometry_DuctTape";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("DuctTape");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_DuctTape";
                break;

            case "f6e85de3-6dcc-4e7f-87fd-cee8c3d25d51":
            case "Electricity":
                mesh.geometry.name = "geometry_Electricity";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                // LegacyGLTF maps TEXCOORD_1 → uv2; legacy Electricity uses a_texcoord1 as edge offset.
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                renameAttribute(mesh, "uv3", "a_texcoord2");
                shader = await this.tiltShaderLoader.loadAsync("Electricity");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Electricity";
                break;

            case "02ffb866-7fb2-4d15-b761-1012cefb1360":
            case "Embers":
                mesh.geometry.name = "geometry_Embers";

                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Embers");
                mesh.material = shader;
                mesh.material.name = "material_Embers";
                break;

            case "0ad58bbd-42bc-484e-ad9a-b61036ff4ce7":
            case "EnvironmentDiffuse":
                mesh.geometry.name = "geometry_EnvironmentDiffuse";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                // No NodeMaterial port — keep stock/LegacyGLTF material.
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] EnvironmentDiffuse has no NodeMaterial; keeping existing material');
                break;

            case "d01d9d6c-9a61-4aba-8146-5891fafb013b":
            case "EnvironmentDiffuseLightMap":
                mesh.geometry.name = "geometry_EnvironmentDiffuseLightMap";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                console.warn('[GLTFGoogleTiltBrushMaterialExtension] EnvironmentDiffuseLightMap has no NodeMaterial; keeping existing material');
                break;

            case "cb92b597-94ca-4255-b017-0e3f42f12f9e":
            case "Fire":
                mesh.geometry.name = "geometry_Fire";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Fire");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Fire";
                break;

            case "2d35bcf0-e4d8-452c-97b1-3311be063130":
            case "280c0a7a-aad8-416c-a7d2-df63d129ca70":
            case "55303bc4-c749-4a72-98d9-d23e68e76e18":
            case "Flat":
                mesh.geometry.name = "geometry_Flat";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Flat");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Flat";
                break;

            case "cf019139-d41c-4eb0-a1d0-5cf54b0a42f3":
            case "Highlighter":
                mesh.geometry.name = "geometry_Highlighter";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Highlighter");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Highlighter";
                break;

            case "dce872c2-7b49-4684-b59b-c45387949c5c":
            case "e8ef32b1-baa8-460a-9c2c-9cf8506794f5":
            case "Hypercolor":
                mesh.geometry.name = "geometry_Hypercolor";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Hypercolor");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Hypercolor";
                break;

            case "6a1cf9f9-032c-45ec-9b6e-a6680bee32e9":
            case "HyperGrid":
                mesh.geometry.name = "geometry_HyperGrid";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                // LegacyGLTF maps TEXCOORD_1 → uv2 (size lives in xyz).
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("HyperGrid");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_HyperGrid";
                break;

            case "2f212815-f4d3-c1a4-681a-feeaf9c6dc37":
            case "Icing":
                mesh.geometry.name = "geometry_Icing";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");

                shader = await this.tiltShaderLoader.loadAsync("Icing");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Icing";
                break;

            case "f5c336cf-5108-4b40-ade9-c687504385ab":
            case "c0012095-3ffd-4040-8ee1-fc180d346eaa":
            case "Ink":
                mesh.geometry.name = "geometry_Ink";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Ink");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Ink";
                break;

            case "4a76a27a-44d8-4bfe-9a8c-713749a499b0":
            case "ea19de07-d0c0-4484-9198-18489a3c1487":
            case "Leaves":
                mesh.geometry.name = "geometry_Leaves";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Leaves");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Leaves";
                break;

            case "2241cd32-8ba2-48a5-9ee7-2caef7e9ed62":
            case "Light":
                mesh.geometry.name = "geometry_Light";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Light");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Light";
                break;

            case "4391aaaa-df81-4396-9e33-31e4e4930b27":
            case "LightWire":
                mesh.geometry.name = "geometry_LightWire";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("LightWire");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_LightWire";
                break;

            case "d381e0f5-3def-4a0d-8853-31e9200bcbda":
            case "Lofted":
                mesh.geometry.name = "geometry_Lofted";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Lofted");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Lofted";
                break;

            case "429ed64a-4e97-4466-84d3-145a861ef684":
            case "Marker":
                mesh.geometry.name = "geometry_Marker";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Marker");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Marker";
                break;

            case "79348357-432d-4746-8e29-0e25c112e3aa":
            case "MatteHull":
                mesh.geometry.name = "geometry_MatteHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("MatteHull");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_MatteHull";
                break;

            case "b2ffef01-eaaa-4ab5-aa64-95a2c4f5dbc6":
            case "NeonPulse":
                mesh.geometry.name = "geometry_NeonPulse";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("NeonPulse");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_NeonPulse";
                break;

            case "f72ec0e7-a844-4e38-82e3-140c44772699":
            case "c515dad7-4393-4681-81ad-162ef052241b":
            case "OilPaint":
                mesh.geometry.name = "geometry_OilPaint";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("OilPaint");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_OilPaint";
                break;

            case "f1114e2e-eb8d-4fde-915a-6e653b54e9f5":
            case "759f1ebd-20cd-4720-8d41-234e0da63716":
            case "Paper":
                mesh.geometry.name = "geometry_Paper";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Paper");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Paper";
                break;

            case "f86a096c-2f4f-4f9d-ae19-81b99f2944e0":
            case "PbrTemplate":
                mesh.geometry.name = "geometry_PbrTemplate";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await loadPbrTemplateMaterial();
                if (shader) {
                    this.applyLoadedBrushFlags(shader);
                    mesh.material = shader;
                    mesh.material.name = "material_PbrTemplate";
                }
                break;

            case "19826f62-42ac-4a9e-8b77-4231fbd0cfbf":
            case "PbrTransparentTemplate":
                mesh.geometry.name = "geometry_PbrTransparentTemplate";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await loadPbrTransparentTemplateMaterial();
                if (shader) {
                    this.applyLoadedBrushFlags(shader);
                    mesh.material = shader;
                    mesh.material.name = "material_PbrTransparentTemplate";
                }
                break;

            case "e0abbc80-0f80-e854-4970-8924a0863dcc":
            case "Petal":
                mesh.geometry.name = "geometry_Petal";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Petal");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Petal";
                break;

            case "c33714d1-b2f9-412e-bd50-1884c9d46336":
            case "Plasma":
                mesh.geometry.name = "geometry_Plasma";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Plasma");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Plasma";
                break;

            case "ad1ad437-76e2-450d-a23a-e17f8310b960":
            case "Rainbow":
                mesh.geometry.name = "geometry_Rainbow";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Rainbow");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Rainbow";
                break;

            case "faaa4d44-fcfb-4177-96be-753ac0421ba3":
            case "ShinyHull":
                mesh.geometry.name = "geometry_ShinyHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("ShinyHull");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_ShinyHull";
                break;

            case "70d79cca-b159-4f35-990c-f02193947fe8":
            case "Smoke":
                mesh.geometry.name = "geometry_Smoke";
                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Smoke");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Smoke";
                break;

            case "d902ed8b-d0d1-476c-a8de-878a79e3a34c":
            case "Snow":
                mesh.geometry.name = "geometry_Snow";
                
                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Snow");
                mesh.material = shader;
                mesh.material.name = "material_Snow";
                break;

            case "accb32f5-4509-454f-93f8-1df3fd31df1b":
            case "SoftHighlighter":
                mesh.geometry.name = "geometry_SoftHighlighter";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("SoftHighlighter");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_SoftHighlighter";
                break;

            case "cf7f0059-7aeb-53a4-2b67-c83d863a9ffa":
            case "Spikes":
                mesh.geometry.name = "geometry_Spikes";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Spikes");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Spikes";
                break;

            case "8dc4a70c-d558-4efd-a5ed-d4e860f40dc3":
            case "7a1c8107-50c5-4b70-9a39-421576d6617e":
            case "Splatter":
                mesh.geometry.name = "geometry_Splatter";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Splatter");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Splatter";
                break;

            case "0eb4db27-3f82-408d-b5a1-19ebd7d5b711":
            case "Stars":
                mesh.geometry.name = "geometry_Stars";

                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Stars");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Stars";
                break;

            case "44bb800a-fbc3-4592-8426-94ecb05ddec3":
            case "Streamers":
                mesh.geometry.name = "geometry_Streamers";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Streamers");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Streamers";
                break;

            case "0077f88c-d93a-42f3-b59b-b31c50cdb414":
            case "Taffy":
                mesh.geometry.name = "geometry_Taffy";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Taffy");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Taffy";
                break;

            case "b468c1fb-f254-41ed-8ec9-57030bc5660c":
            case "c8ccb53d-ae13-45ef-8afb-b730d81394eb":
            case "TaperedFlat":
                mesh.geometry.name = "geometry_TaperedFlat";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("TaperedFlat");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_TaperedFlat";
                break;

            case "d90c6ad8-af0f-4b54-b422-e0f92abe1b3c":
            case "TaperedMarker":
                mesh.geometry.name = "geometry_TaperedMarker";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("TaperedMarker");
                this.applyLoadedBrushFlags(shader, { lights: false });
                mesh.material = shader;
                mesh.material.name = "material_TaperedMarker";
                break;

            case "1a26b8c0-8a07-4f8a-9fac-d2ef36e0cad0":
            case "TaperedMarker_Flat":
                mesh.geometry.name = "geometry_TaperedMarker_Flat";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("TaperedMarker_Flat");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_TaperedMarker_Flat";
                break;

            case "75b32cf0-fdd6-4d89-a64b-e2a00b247b0f":
            case "fdf0326a-c0d1-4fed-b101-9db0ff6d071f":
            case "ThickPaint":
                mesh.geometry.name = "geometry_ThickPaint";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("ThickPaint");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_ThickPaint";
                break;

            case "4391385a-df73-4396-9e33-31e4e4930b27":
            case "Toon":
                mesh.geometry.name = "geometry_Toon";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Toon");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Toon";
                break;

            case "a8fea537-da7c-4d4b-817f-24f074725d6d":
            case "UnlitHull":
                mesh.geometry.name = "geometry_UnlitHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("UnlitHull");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_UnlitHull";
                break;

            case "d229d335-c334-495a-a801-660ac8a87360":
            case "VelvetInk":
                mesh.geometry.name = "geometry_VelvetInk";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("VelvetInk");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_VelvetInk";
                break;

            case "10201aa3-ebc2-42d8-84b7-2e63f6eeb8ab":
            case "Waveform":
                mesh.geometry.name = "geometry_Waveform";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Waveform");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Waveform";
                break;

            case "b67c0e81-ce6d-40a8-aeb0-ef036b081aa3":
            case "dea67637-cd1a-27e4-c9b1-52f4bbcb84e5":
            case "WetPaint":
                mesh.geometry.name = "geometry_WetPaint";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("WetPaint");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_WetPaint";
                break;

            case "5347acf0-a8e2-47b6-8346-30c70719d763":
            case "e814fef1-97fd-7194-4a2f-50c2bb918be2":
            case "WigglyGraphite":
                mesh.geometry.name = "geometry_WigglyGraphite";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("WigglyGraphite");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_WigglyGraphite";
                break;

            case "4391385a-cf83-4396-9e33-31e4e4930b27":
            case "Wire":
                mesh.geometry.name = "geometry_Wire";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Wire");
                mesh.material = shader;
                mesh.material.name = "material_Wire";
                break;

            // Experimental brushes


            case "cf3401b3-4ada-4877-995a-1aa64e7b604a":
            case "SvgTemplate":
                mesh.geometry.name = "geometry_SvgTemplate";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("SvgTemplate");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_SvgTemplate";
                break;

            case "1b897b7e-9b76-425a-b031-a867c48df409":
            case "4465b5ef-3605-bec4-2b3e-6b04508ddb6b":
            case "Gouache":
                mesh.geometry.name = "geometry_Gouache";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Gouache");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Gouache";
                break;

            case "8e58ceea-7830-49b4-aba9-6215104ab52a":
            case "MylarTube":
                mesh.geometry.name = "geometry_MylarTube";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("MylarTube");
                mesh.material = shader;
                mesh.material.name = "material_MylarTube";
                break;

            case "03a529e1-f519-3dd4-582d-2d5cd92c3f4f":
            case "Rain":
                mesh.geometry.name = "geometry_Rain";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                
                
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Rain");
                mesh.material = shader;
                mesh.material.name = "material_Rain";
                this.applyLoadedBrushFlags(shader);
                break;

            case "725f4c6a-6427-6524-29ab-da371924adab":
            case "DryBrush":
                mesh.geometry.name = "geometry_DryBrush";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("DryBrush");
                mesh.material = shader;
                mesh.material.name = "material_DryBrush";
                break;

            case "ddda8745-4bb5-ac54-88b6-d1480370583e":
            case "LeakyPen":
                mesh.geometry.name = "geometry_LeakyPen";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("LeakyPen");
                mesh.material = shader;
                mesh.material.name = "material_LeakyPen";
                break;

            case "50e99447-3861-05f4-697d-a1b96e771b98":
            case "Sparks":
                mesh.geometry.name = "geometry_Sparks";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Sparks");
                mesh.material = shader;
                mesh.material.name = "material_Sparks";
                this.applyLoadedBrushFlags(shader);
                break;

            case "7136a729-1aab-bd24-f8b2-ca88b6adfb67":
            case "Wind":
                mesh.geometry.name = "geometry_Wind";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Wind");
                mesh.material = shader;
                mesh.material.name = "material_Wind";
                this.applyLoadedBrushFlags(shader);
                break;

            case "a8147ce1-005e-abe4-88e8-09a1eaadcc89":
            case "Rising Bubbles":
                mesh.geometry.name = "geometry_Rising Bubbles";

                setAttributeIfExists(mesh, "position", "a_position");
                renameAttribute(mesh, "_tb_unity_normal", "a_normal");
                renameAttribute(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                ensureParticleCornerAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("Rising Bubbles");
                mesh.material = shader;
                mesh.material.name = "material_Rising Bubbles";
                this.applyLoadedBrushFlags(shader);
                break;

            case "9568870f-8594-60f4-1b20-dfbc8a5eac0e":
            case "TaperedWire":
                mesh.geometry.name = "geometry_TaperedWire";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("TaperedWire");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_TaperedWire";
                break;

            case "2e03b1bf-3ebd-4609-9d7e-f4cafadc4dfa":
            case "SquarePaper":
                mesh.geometry.name = "geometry_SquarePaper";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                // TODO Generate tangents?
                // setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("SquarePaper");
                mesh.material = shader;
                mesh.material.name = "material_SquarePaper";
                break;

            case "39ee7377-7a9e-47a7-a0f8-0c77712f75d3":
            case "ThickGeometry":
                mesh.geometry.name = "geometry_ThickGeometry";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");

                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("ThickGeometry");
                mesh.material = shader;
                mesh.material.name = "material_ThickGeometry";
                break;

            case "2c1a6a63-6552-4d23-86d7-58f6fba8581b":
            case "Wireframe":
                mesh.geometry.name = "geometry_Wireframe";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Wireframe");
                mesh.material = shader;
                mesh.material.name = "material_Wireframe";
                break;

            case "f28c395c-a57d-464b-8f0b-558c59478fa3":
            case "Muscle":
                mesh.geometry.name = "geometry_Muscle";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Muscle");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Muscle";
                break;

            case "99aafe96-1645-44cd-99bd-979bc6ef37c5":
            case "Guts":
                mesh.geometry.name = "geometry_Guts";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Guts");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Guts";
                break;

            case "53d753ef-083c-45e1-98e7-4459b4471219":
            case "Fire2":
                mesh.geometry.name = "geometry_Fire2";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);

                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");

                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");

                shader = await this.tiltShaderLoader.loadAsync("Fire2");
                mesh.material = shader;
                mesh.material.name = "material_Fire2";
                this.applyLoadedBrushFlags(shader);
                break;

            case "9871385a-df73-4396-9e33-31e4e4930b27":
            case "TubeToonInverted":
                mesh.geometry.name = "geometry_TubeToonInverted";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("TubeToonInverted");
                mesh.material = shader;
                mesh.material.name = "material_TubeToonInverted";
                break;

            case "4391ffaa-df73-4396-9e33-31e4e4930b27":
            case "FacetedTube":
                mesh.geometry.name = "geometry_FacetedTube";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                shader = await this.tiltShaderLoader.loadAsync("FacetedTube");
                mesh.material = shader;
                mesh.material.name = "material_FacetedTube";
                break;

            case "6a1cf9f9-032c-45ec-9b6e-a6680bee30f7":
            case "WaveformParticles":
                mesh.geometry.name = "geometry_WaveformParticles";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                setAttributeIfExists(mesh, "uv3", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("WaveformParticles");
                mesh.material = shader;
                mesh.material.name = "material_WaveformParticles";
                this.applyLoadedBrushFlags(shader);
                break;

            case "eba3f993-f9a1-4d35-b84e-bb08f48981a4":
            case "BubbleWand":
                mesh.geometry.name = "geometry_BubbleWand";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1");
                setAttributeIfExists(mesh, "uv3", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("BubbleWand");
                mesh.material = shader;
                mesh.material.name = "material_BubbleWand";
                this.applyLoadedBrushFlags(shader);
                break;

            case "6a1cf9f9-032c-45ec-311e-a6680bee32e9":
            case "DanceFloor":
                mesh.geometry.name = "geometry_DanceFloor";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");

                renameAttribute(mesh, "_tb_timestamp", "a_timestamp");
                ensureTimestampAttribute(mesh);
                ensureQuadIndexAttribute(mesh);

                shader = await this.tiltShaderLoader.loadAsync("DanceFloor");
                mesh.material = shader;
                mesh.material.name = "material_DanceFloor";
                this.applyLoadedBrushFlags(shader);
                break;

            case "0f5820df-cb6b-4a6c-960e-56e4c8000eda":
            case "WaveformTube":
                mesh.geometry.name = "geometry_WaveformTube";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("WaveformTube");
                mesh.material = shader;
                mesh.material.name = "material_WaveformTube";
                this.applyLoadedBrushFlags(shader);
                break;

            case "492b36ff-b337-436a-ba5f-1e87ee86747e":
            case "Drafting":
                mesh.geometry.name = "geometry_Drafting";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Drafting");
                mesh.material = shader;
                mesh.material.name = "material_Drafting";
                break;

            case "f0a2298a-be80-432c-9fee-a86dcc06f4f9":
            case "SingleSided":
                mesh.geometry.name = "geometry_SingleSided";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("SingleSided");
                mesh.material = shader;
                mesh.material.name = "material_SingleSided";
                break;

            case "f4a0550c-332a-4e1a-9793-b71508f4a454":
            case "DoubleFlat":
                mesh.geometry.name = "geometry_DoubleFlat";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("DoubleFlat");
                mesh.material = shader;
                mesh.material.name = "material_DoubleFlat";
                break;

            case "c1c9b26d-673a-4dc6-b373-51715654ab96":
            case "TubeAdditive":
                mesh.geometry.name = "geometry_TubeAdditive";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("TubeAdditive");
                mesh.material = shader;
                mesh.material.name = "material_TubeAdditive";
                break;

            case "a555b809-2017-46cb-ac26-e63173d8f45e":
            case "Feather":
                mesh.geometry.name = "geometry_Feather";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Feather");
                mesh.material = shader;
                mesh.material.name = "material_Feather";
                break;

            case "84d5bbb2-6634-8434-f8a7-681b576b4664":
            case "DuctTapeGeometry":
                mesh.geometry.name = "geometry_DuctTapeGeometry";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");

                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("DuctTapeGeometry");
                mesh.material = shader;
                mesh.material.name = "material_DuctTapeGeometry";
                break;

            case "3d9755da-56c7-7294-9b1d-5ec349975f52":
            case "TaperedHueShift":
                mesh.geometry.name = "geometry_TaperedHueShift";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("TaperedHueShift");
                mesh.material = shader;
                mesh.material.name = "material_TaperedHueShift";
                break;

            case "1cf94f63-f57a-4a1a-ad14-295af4f5ab5c":
            case "Lacewing":
                mesh.geometry.name = "geometry_Lacewing";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                setAttributeIfExists(mesh, "uv2", "a_texcoord1", { warn: false });
                shader = await this.tiltShaderLoader.loadAsync("Lacewing");
                mesh.material = shader;
                mesh.material.name = "material_Lacewing";
                break;

            case "c86c058d-1bda-2e94-08db-f3d6a96ac4a1":
            case "Marbled Rainbow":
                mesh.geometry.name = "geometry_Marbled Rainbow";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Marbled Rainbow");
                mesh.material = shader;
                mesh.material.name = "material_Marbled Rainbow";
                break;

            case "fde6e778-0f7a-e584-38d6-89d44cee59f6":
            case "Charcoal":
                mesh.geometry.name = "geometry_Charcoal";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Charcoal");
                mesh.material = shader;
                mesh.material.name = "material_Charcoal";
                break;

            case "f8ba3d18-01fc-4d7b-b2d9-b99d10b8e7cf":
            case "KeijiroTube":
                mesh.geometry.name = "geometry_KeijiroTube";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                setAttributeIfExists(mesh, "uv1", "a_texcoord1");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("KeijiroTube");
                mesh.material = shader;
                mesh.material.name = "material_KeijiroTube";
                this.applyLoadedBrushFlags(shader);
                break;

            case "c5da2e70-a6e4-63a4-898c-5cfedef09c97":
            case "Lofted (Hue Shift)":
                mesh.geometry.name = "geometry_Lofted (Hue Shift)";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Lofted (Hue Shift)");
                mesh.material = shader;
                mesh.material.name = "material_Lofted (Hue Shift)";
                break;

            case "62fef968-e842-3224-4a0e-1fdb7cfb745c":
            case "Wire (Lit)":
                mesh.geometry.name = "geometry_Wire (Lit)";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Wire (Lit)");
                mesh.material = shader;
                mesh.material.name = "material_Wire (Lit)";
                break;

            case "d120944d-772f-4062-99c6-46a6f219eeaf":
            case "WaveformFFT":
                mesh.geometry.name = "geometry_WaveformFFT";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("WaveformFFT");
                mesh.material = shader;
                mesh.material.name = "material_WaveformFFT";
                this.applyLoadedBrushFlags(shader);
                break;

            case "d9cc5e99-ace1-4d12-96e0-4a7c18c99cfc":
            case "Fairy":
                mesh.geometry.name = "geometry_Fairy";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Fairy");
                mesh.material = shader;
                mesh.material.name = "material_Fairy";
                this.applyLoadedBrushFlags(shader);
                break;

            case "bdf65db2-1fb7-4202-b5e0-c6b5e3ea851e":
            case "Space":
                mesh.geometry.name = "geometry_Space";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                shader = await this.tiltShaderLoader.loadAsync("Space");
                mesh.material = shader;
                mesh.material.name = "material_Space";
                this.applyLoadedBrushFlags(shader);
                break;

            case "355b3579-bf1d-4ff5-a200-704437fe684b":
            case "SmoothHull":
                mesh.geometry.name = "geometry_SmoothHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("SmoothHull");
                mesh.material = shader;
                mesh.material.name = "material_SmoothHull";
                break;

            case "7259cce5-41c1-ec74-c885-78af28a31d95":
            case "Leaves2":
                mesh.geometry.name = "geometry_Leaves2";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("Leaves2");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_Leaves2";
                break;

            case "7c972c27-d3c2-8af4-7bf8-5d9db8f0b7bb":
            case "InkGeometry":
                mesh.geometry.name = "geometry_InkGeometry";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("InkGeometry");
                mesh.material = shader;
                mesh.material.name = "material_InkGeometry";
                break;

            case "7ae1f880-a517-44a0-99f9-1cab654498c6":
            case "ConcaveHull":
                mesh.geometry.name = "geometry_ConcaveHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("ConcaveHull");
                mesh.material = shader;
                mesh.material.name = "material_ConcaveHull";
                break;

            case "d3f3b18a-da03-f694-b838-28ba8e749a98":
            case "3D Printing Brush":
                mesh.geometry.name = "geometry_3D Printing Brush";

                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("3D Printing Brush");
                mesh.material = shader;
                mesh.material.name = "material_3D Printing Brush";
                break;

            case "cc131ff8-0d17-4677-93e0-d7cd19fea9ac":
            case "PassthroughHull":
                mesh.geometry.name = "geometry_PassthroughHull";

                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                setAttributeIfExists(mesh, "tangent", "a_tangent");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("PassthroughHull");
                this.applyLoadedBrushFlags(shader);
                mesh.material = shader;
                mesh.material.name = "material_PassthroughHull";
                break;

            case "b3e7f8c2-4d5a-1e9b-6c8f-3a7d2f1e9c4b":
            case "QuillCube":
                mesh.geometry.name = "geometry_QuillCube";
                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("QuillCylinder");
                shader.alphaToCoverage = true;
                mesh.material = shader;
                mesh.material.name = "material_QuillCube";
                break;

            case "f1c4e3e7-2a9f-4b5d-8c3e-7d9a1f8e6b4c":
            case "QuillCylinder":
                mesh.geometry.name = "geometry_QuillCylinder";
                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("QuillCylinder");
                shader.alphaToCoverage = true;
                mesh.material = shader;
                mesh.material.name = "material_QuillCylinder";
                break;

            case "a2d5f6b8-9c1e-4f3a-7b8d-2e6c9f4a1d5b":
            case "QuillEllipse":
                mesh.geometry.name = "geometry_QuillEllipse";
                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("QuillEllipse");
                shader.alphaToCoverage = true;
                mesh.material = shader;
                mesh.material.name = "material_QuillEllipse";
                break;

            case "c4f8b3e2-9d1a-5e7f-4c3b-8a6d2f9e1c7b":
            case "QuillRibbon":
                mesh.geometry.name = "geometry_QuillRibbon";
                setAttributeIfExists(mesh, "position", "a_position");
                setAttributeIfExists(mesh, "normal", "a_normal");
                copyFixColorAttribute(mesh);
                renameAttribute(mesh, "_tb_unity_texcoord_0", "a_texcoord0");
                renameAttribute(mesh, "texcoord_0", "a_texcoord0");
                setAttributeIfExists(mesh, "uv", "a_texcoord0");
                renameAttribute(mesh, "_tb_unity_texcoord_1", "a_texcoord1");
                renameAttribute(mesh, "texcoord_1", "a_texcoord1");
                shader = await this.tiltShaderLoader.loadAsync("QuillRibbon");
                shader.alphaToCoverage = true;
                mesh.material = shader;
                mesh.material.name = "material_QuillRibbon";
                break;

            default:
                console.warn(`Could not find brush with guid ${guidOrName}!`);
        }

        // Set the exporter type flag on the shader (keep TSL node binding if present).
        if (mesh.material?.uniforms?.u_isNewTiltExporter) {
            mesh.material.uniforms.u_isNewTiltExporter.value = isNewTiltExporter ? 1 : 0;
        } else if (mesh.material?.uniforms) {
            mesh.material.uniforms.u_isNewTiltExporter = { value: isNewTiltExporter };
        } else if (mesh.material?.userData?.tiltUniforms?.u_isNewTiltExporter) {
            mesh.material.userData.tiltUniforms.u_isNewTiltExporter.value = isNewTiltExporter ? 1 : 0;
        }

        mesh.onBeforeRender = (renderer, scene, camera, _geometry, material, _group) => {
            const mat: any = material;
            const setUniform = (name: string, value: any) => {
                if (mat?.uniforms?.[name]) {
                    const target = mat.uniforms[name].value;
                    // Color uses r/g/b; Vector3/Vector4 use x/y/z — .copy(Color) leaves components undefined.
                    if (value?.isColor && target?.isVector3) {
                        target.set(value.r, value.g, value.b);
                    } else if (value?.isColor && target?.isVector4) {
                        target.set(value.r, value.g, value.b, 1);
                    } else if (value?.isColor && target?.isColor) {
                        target.copy(value);
                    } else if (target?.copy && (value?.isVector3 || value?.isVector4 || value?.isMatrix4)) {
                        target.copy(value);
                    } else if (typeof value === 'number') {
                        mat.uniforms[name].value = value;
                    } else if (target?.copy) {
                        target.copy(value);
                    } else {
                        mat.uniforms[name].value = value;
                    }
                }
            };

            if (mat?.uniforms?.u_time || mat?.userData?.tiltUniforms?.u_time) {
                this.timer.update();
                const elapsedTime = this.timer.getElapsed();
                // _Time from https://docs.unity3d.com/Manual/SL-UnityShaderVariables.html
                const time = new THREE.Vector4(elapsedTime / 20, elapsedTime, elapsedTime * 2, elapsedTime * 3);
                setUniform('u_time', time);
            }

            if (mat?.uniforms?.cameraPosition) {
                mat.uniforms["cameraPosition"].value = camera.position;
            }

            // Prefer scene lights by name. Brush shaders expect view-space light directions.
            const light0 = scene.getObjectByName('SceneLight0');
            const light1 = scene.getObjectByName('SceneLight1');
            const updateLight = (light: any, colorKey: string, matrixKey: string) => {
                if (!light) return;
                setUniform(colorKey, new THREE.Vector4(light.color.r, light.color.g, light.color.b, 1));
                // World direction → view space (matches directionalLights[].direction).
                const direction = light.position.clone().normalize().negate();
                direction.transformDirection(camera.matrixWorldInverse).normalize();
                setUniform(
                    matrixKey,
                    new THREE.Matrix4().lookAt(
                        new THREE.Vector3(0, 0, 0),
                        direction,
                        new THREE.Vector3(0, 1, 0),
                    ),
                );
            };
            updateLight(light0, 'u_SceneLight_0_color', 'u_SceneLight_0_matrix');
            updateLight(light1, 'u_SceneLight_1_color', 'u_SceneLight_1_matrix');

            if(mat?.uniforms?.directionalLights?.value) {
                // Main Light
                if(mat.uniforms.directionalLights.value[0]) {

                    // Color
                    if(mat.uniforms.u_SceneLight_0_color) {
                        const color = mat.uniforms.directionalLights.value[0].color;
                        mat.uniforms.u_SceneLight_0_color.value = new THREE.Vector4(color.r, color.g, color.b, 1);
                    }
                    // Transforms
                    if(mat.uniforms.u_SceneLight_0_matrix) {
                        const direction = mat.uniforms.directionalLights.value[0].direction.clone().negate();
                        mat.uniforms.u_SceneLight_0_matrix.value = new THREE.Matrix4().lookAt(
                            new THREE.Vector3(0, 0, 0),
                            direction,
                            new THREE.Vector3(0, 1, 0)
                        );
                    }
                }

                // Shadow Light
                if(mat.uniforms.directionalLights.value[1]) {

                    // Color
                    if(mat.uniforms.u_SceneLight_1_color) {
                        const color = mat.uniforms.directionalLights.value[1].color;
                        mat.uniforms.u_SceneLight_1_color.value = new THREE.Vector4(color.r, color.g, color.b, 1);
                    }
                    // Transforms
                    if(mat.uniforms.u_SceneLight_1_matrix) {
                        const direction = mat.uniforms.directionalLights.value[1].direction.clone().negate();
                        mat.uniforms.u_SceneLight_1_matrix.value = new THREE.Matrix4().lookAt(
                            new THREE.Vector3(0, 0, 0),
                            direction,
                            new THREE.Vector3(0, 1, 0)
                        );
                    }
                }

            }

            // Ambient Light
            if(mat?.uniforms?.ambientLightColor?.value) {
                if(mat.uniforms.u_ambient_light_color) {
                    const colorArray = mat.uniforms.ambientLightColor.value;
                    mat.uniforms.u_ambient_light_color.value = new THREE.Vector4(colorArray[0], colorArray[1], colorArray[2], 1);
                }
            } else if (scene?.children) {
                const ambient = scene.children.find((c: any) => c.isAmbientLight) as THREE.AmbientLight | undefined;
                if (ambient) {
                    setUniform(
                        'u_ambient_light_color',
                        new THREE.Vector4(ambient.color.r, ambient.color.g, ambient.color.b, 1),
                    );
                }
            }

            // Fog
            if (scene?.fog) {
                if (scene.fog.color) setUniform('u_fogColor', scene.fog.color);
                const fogDensity = (scene.fog as THREE.FogExp2).density;
                if (fogDensity != null) setUniform('u_fogDensity', fogDensity);
            }
            if(mat?.uniforms?.fogColor?.value) {
                if(mat.uniforms.u_fogColor) {
                    const colorArray = mat.uniforms.fogColor.value;
                    mat.uniforms.u_fogColor.value = colorArray;
                }
            }
            if(mat?.uniforms?.fogDensity?.value) {
                if(mat.uniforms.u_fogDensity) {
                    mat.uniforms.u_fogDensity.value = mat.uniforms.fogDensity.value;
                }
            }

            if (mat?.alphaToCoverage) {
                try {
                    const gl = renderer.getContext?.();
                    if (gl?.SAMPLES != null) {
                        const samples = gl.getParameter(gl.SAMPLES);
                        const a2cEnabled = samples > 0;
                        setUniform('u_A2CEnabled', a2cEnabled ? 1.0 : 0.0);
                        if (a2cEnabled && gl.enable) {
                            gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE);
                        }
                    }
                } catch {
                    // WebGPU backend may not expose a WebGL context
                }
            }
        };
    }
}
