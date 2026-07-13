import { ReactiveElement, ReactiveElementProps } from '@io-gui/core';
type Artist = {
    name: string;
    assets: string[];
};
export declare class PageArtists extends ReactiveElement {
    static get Style(): string;
    src: string;
    loading: boolean;
    artists: Record<string, Artist>;
    ids: string[];
    static get Listeners(): {
        scroll: string;
    };
    ready(): void;
    srcChanged(): void;
    onResized(): void;
    onScroll(): void;
    mutated(): void;
}
export declare const pageArtists: (props?: ReactiveElementProps) => import("@io-gui/core").VDOMElement;
export {};
