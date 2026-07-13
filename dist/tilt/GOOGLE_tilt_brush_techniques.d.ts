import * as THREE from 'three';
import { TiltShaderLoader } from './TiltShaderLoader.js';
type GltfParser = {
    json: any;
    options: {
        manager: THREE.LoadingManager;
    };
};
export declare class GLTFGoogleTiltBrushTechniquesExtension {
    name: string;
    parser: GltfParser;
    brushPath: string;
    materialDefs: Record<string, any>;
    tiltShaderLoader: TiltShaderLoader;
    constructor(parser: GltfParser, brushPath: string);
    beforeRoot(): null | undefined;
}
export {};
