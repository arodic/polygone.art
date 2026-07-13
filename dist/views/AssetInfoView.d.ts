import { ReactiveElement, ReactiveElementProps, WithBinding } from '@io-gui/core';
import { AssetInfo } from '../models/AssetInfo';
type AssetInfoViewProps = ReactiveElementProps & {
    assetInfo: AssetInfo;
    guid: WithBinding<string>;
};
export declare class AssetInfoView extends ReactiveElement {
    static get Style(): string;
    assetInfo: AssetInfo;
    guid: string;
    onDownloadClicked(value: any): void;
    ready(): void;
    assetInfoMutated(): void;
}
export declare const assetInfoView: (props: AssetInfoViewProps) => import("@io-gui/core").VDOMElement;
export {};
