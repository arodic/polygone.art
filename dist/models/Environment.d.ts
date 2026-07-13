import { ReactiveObject, ReactiveObjectProps } from '@io-gui/core';
import { WebGPURenderer, Texture } from 'three/webgpu';
export type EnvironmentProps = ReactiveObjectProps & {
    path?: string;
};
export declare class Environment extends ReactiveObject {
    path: string;
    rawTexture: Texture | undefined;
    texture: Texture;
    _loadGeneration: number;
    private _pmremGenerator;
    constructor(args: EnvironmentProps);
    pathChanged(): void;
    generateTextureFromRawTexture(): void;
    initPMREMGeneratorWithRenderer(renderer: WebGPURenderer): void;
}
