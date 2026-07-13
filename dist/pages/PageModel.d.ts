import { ReactiveElement, ReactiveElementProps, WithBinding } from '@io-gui/core';
import { AssetInfo } from '../models/AssetInfo';
import { ModelViewer } from '../applets/ModelViewer.js';
import { ModelViewerCameraTool } from '../tools/ModelViewerCameraTool.js';
type PageModelProps = ReactiveElementProps & {
    guid: WithBinding<string>;
};
export declare class PageModel extends ReactiveElement {
    static get Style(): string;
    guid: string;
    assetInfo: AssetInfo;
    applet: ModelViewer;
    cameraTool: ModelViewerCameraTool;
    ready(): void;
}
export declare const pageModel: (props: PageModelProps) => import("@io-gui/core").VDOMElement;
export {};
