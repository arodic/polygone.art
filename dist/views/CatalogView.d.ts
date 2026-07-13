import { ReactiveElement, ReactiveElementProps } from '@io-gui/core';
type CatalogViewProps = ReactiveElementProps & {};
export declare class CatalogView extends ReactiveElement {
    static get Style(): string;
    size: string;
    type: string;
    filter: string;
    ready(): void;
    mutated(): void;
}
export declare const catalogView: (props: CatalogViewProps) => import("@io-gui/core").VDOMElement;
export {};
