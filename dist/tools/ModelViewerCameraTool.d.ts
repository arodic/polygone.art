import { IoThreeViewport, ToolBase, ToolBaseProps } from '@io-gui/three';
import { ModelViewer } from '../applets/ModelViewer.js';
export declare class ModelViewerCameraTool extends ToolBase {
    touchMode: boolean;
    private readonly _registeredViewports;
    private readonly _viewportState;
    private _rafId;
    private _onModelReady;
    private _onPointerSchemeChanged;
    constructor(args?: ToolBaseProps);
    get modelViewer(): ModelViewer;
    registerViewport(viewport: IoThreeViewport): void;
    unregisterViewport(viewport: IoThreeViewport): void;
    dispose(): void;
    syncAllViewports(): void;
    private onPointerSchemeChanged;
    private setupViewport;
    private teardownViewport;
    private syncOrbitTarget;
    private startAnimationLoop;
    private _lastFrameTime;
    private stopAnimationLoop;
    private applyMobileControls;
}
export type ModelViewerCameraToolProps = ToolBaseProps;
export declare function modelViewerCameraTool(props: ModelViewerCameraToolProps): ModelViewerCameraTool;
