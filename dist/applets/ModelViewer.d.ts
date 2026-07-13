import { ThreeApplet } from '@io-gui/three';
import { GridHelper, Object3D, PerspectiveCamera, WebGPURenderer } from 'three/webgpu';
import { AssetInfo } from '../models/AssetInfo';
export declare const BRUSH_PATH = "/assets/brushes/";
export declare class ModelViewer extends ThreeApplet {
    assetInfo: AssetInfo;
    modelRoot: Object3D;
    gridHelper: GridHelper;
    camera: PerspectiveCamera;
    constructor(assetInfo: AssetInfo);
    onRendererInitialized(renderer: WebGPURenderer): void;
    assetInfoMutated(): void;
    clearModel(): void;
    loadGLTF2Model(url: string): Promise<void>;
    loadLegacyGLTFModelWithTiltMaterials(url: string): Promise<void>;
    loadPresentation(jsonUrl: string): Promise<void>;
}
