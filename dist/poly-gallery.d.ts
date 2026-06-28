import { ReactiveElement, ReactiveElementProps, WithBinding } from '@io-gui/core';
type PolyGalleryProps = ReactiveElementProps & {
    size: WithBinding<string>;
    type: WithBinding<string>;
    filter: WithBinding<string>;
    assetsSrc: string;
    thumbsSrc: string;
};
export declare class PolyGallery extends ReactiveElement {
    static get Style(): string;
    size: string;
    type: string;
    filter: string;
    assetsSrc: string;
    thumbsSrc: string;
    assets: Record<string, {
        authorId: string;
        name: string;
        tags: string[];
    }>;
    items: string[];
    thumbnails: Record<string, string>;
    assetLoaderTimeout: ReturnType<typeof setTimeout> | null;
    thumbnailLoaderTimeout: ReturnType<typeof setTimeout> | null;
    filterTimeout: ReturnType<typeof setTimeout> | null;
    static get Listeners(): {
        scroll: string;
    };
    thumbsSrcChanged(): void;
    assetsSrcChanged(): void;
    onResized(): void;
    onScroll(): void;
    typeChanged(): void;
    filterChanged(): void;
    _applyFilter(): void;
    mutated(): void;
}
export declare const polyGallery: (props: PolyGalleryProps) => import("@io-gui/core").VDOMElement;
export {};
