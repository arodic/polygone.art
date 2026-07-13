import * as THREE from 'three';
import { TiltShaderLoader } from './TiltShaderLoader.js';
type GltfParser = {
    json: any;
    options: {
        manager: THREE.LoadingManager;
    };
    associations: WeakMap<object, any>;
};
type BrushFlags = {
    lights?: boolean;
    fog?: boolean;
};
/** Brush meshes always carry a single dynamic material with uniforms. */
type BrushMesh = THREE.Mesh & {
    material: any;
};
export declare class GLTFGoogleTiltBrushMaterialExtension {
    name: string;
    altName: string;
    parser: GltfParser;
    brushPath: string;
    isLegacy: boolean;
    tiltShaderLoader: TiltShaderLoader;
    timer: THREE.Timer;
    constructor(parser: GltfParser, brushPath: string, isLegacy?: boolean);
    /**
     * NodeMaterials bake Tilt Brush fog in TSL; disable Three.js scene fog.
     */
    applyLoadedBrushFlags(shader: any, { lights: _lights, fog: _fog }?: BrushFlags): any;
    beforeRoot(): void;
    afterRoot(glTF: any): Promise<any[]>;
    tryReplaceBlocksName(originalName: string | undefined): string | undefined;
    isTiltGltf(json: any): boolean;
    replaceMaterial(mesh: BrushMesh, guidOrName: string, isNewTiltExporter?: boolean): Promise<void>;
}
export {};
