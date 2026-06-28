import { ReactiveElement, ReactiveElementProps, WithBinding } from '@io-gui/core';
type AssetInfo = Record<string, any>;
type PolyModelViewProps = ReactiveElementProps & {
    guid: WithBinding<string>;
};
export declare class PolyModelView extends ReactiveElement {
    static get Style(): string;
    guid: string;
    assetInfo: AssetInfo | null;
    onResized(): void;
    guidChanged(): void;
    mutated(): void;
}
export declare const polyModelView: (props: PolyModelViewProps) => import("@io-gui/core").VDOMElement;
export {};
