import { ReactiveElement, ReactiveElementProps } from '@io-gui/core';
type Artist = {
    name: string;
    assets: string[];
};
type PolyArtistListProps = ReactiveElementProps & {
    src: string;
};
export declare class PolyArtistList extends ReactiveElement {
    static get Style(): string;
    src: string;
    loading: boolean;
    artists: Record<string, Artist>;
    ids: string[];
    static get Listeners(): {
        scroll: string;
    };
    srcChanged(): void;
    onResized(): void;
    onScroll(): void;
    mutated(): void;
}
export declare const polyArtistList: (props?: PolyArtistListProps) => import("@io-gui/core").VDOMElement;
export {};
