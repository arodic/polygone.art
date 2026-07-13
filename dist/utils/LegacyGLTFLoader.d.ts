import * as THREE from 'three';
export interface LegacyGLTF {
    scene: THREE.Scene;
    scenes: THREE.Scene[];
    cameras: THREE.Camera[];
    animations: unknown[];
    asset?: {
        generator?: string;
        version?: string;
    };
    userData?: Record<string, unknown>;
}
export declare class LegacyGLTFLoader extends THREE.Loader<LegacyGLTF> {
    assetBaseUrl: string;
    reversed: boolean;
    constructor(manager?: THREE.LoadingManager, assetBaseUrl?: string);
    load(url: string, onLoad: (gltf: LegacyGLTF) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): void;
    parse(data: ArrayBuffer, path: string, callback: (gltf: LegacyGLTF) => void): void;
}
