import { ReactiveElement, ReactiveElementProps } from '@io-gui/core';
type PolyThumbnailProps = ReactiveElementProps & {
    guid: string;
    size: number;
    thumbnails: Record<string, string>;
};
export declare class PolyThumbnail extends ReactiveElement {
    static get Style(): string;
    guid: string;
    size: number;
    thumbnails: Record<string, string>;
    static get Listeners(): {
        click: string;
    };
    onClicked(): void;
    thumbnailsMutated(): void;
    sizeChanged(): void;
    mutated(): void;
}
export declare const polyThumbnail: (props?: PolyThumbnailProps) => import("@io-gui/core").VDOMElement;
export {};
