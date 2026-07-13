import * as THREE from 'three';
import type { LoadingManager } from 'three';
import type { MeshBasicNodeMaterial } from 'three/webgpu';
/** Values stored on tilt-brush material uniform templates. */
export type BrushUniformValue = number | number[] | string | null | THREE.Vector3 | THREE.Vector4 | THREE.Texture;
export interface BrushUniform {
    /** Typically a {@link BrushUniformValue}; `any` allows duck-typed clone/copy helpers. */
    value: any;
}
export interface BrushMaterialParams {
    uniforms: Record<string, BrushUniform>;
    side?: number;
    transparent?: boolean;
    depthFunc?: number;
    depthWrite?: boolean;
    depthTest?: boolean;
    blending?: number;
    blendSrc?: number;
    blendDst?: number;
    blendEquation?: number;
    blendSrcAlpha?: number;
    blendDstAlpha?: number;
    blendEquationAlpha?: number;
}
export declare class TiltShaderLoader extends THREE.Loader<MeshBasicNodeMaterial, string> {
    loadedMaterials: Record<string, MeshBasicNodeMaterial>;
    constructor(manager?: LoadingManager);
    load(brushName: string, onLoad: (data: MeshBasicNodeMaterial) => void, _onProgress?: (event: ProgressEvent) => void, onError?: (err: unknown) => void): Promise<void>;
    parse(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial;
    lookupMaterialParams(materialName: string | null | undefined): BrushMaterialParams | null;
    lookupMaterialName(nameOrGuid: string | null | undefined): string | undefined;
}
