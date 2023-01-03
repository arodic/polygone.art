import { IoElement, IoNodeArgs } from 'io-gui';
import './poly-thumbnail.js';
export declare class PolyGallery extends IoElement {
    static get Style(): string;
    size: string;
    type: string;
    filter: string;
    computedSize: number;
    currentBase: number;
    assets: Record<string, any>;
    items: any[];
    thumbnails: Record<string, any>;
    static get Listeners(): {
        scroll: string;
    };
    constructor(properties?: IoNodeArgs);
    connectedCallback(): void;
    onResized(): void;
    calcSize(): void;
    onScroll(): void;
    sizeChanged(): void;
    typeChanged(): void;
    filterChanged(): void;
    applyFilter(): void;
    changed(): void;
}
//# sourceMappingURL=poly-gallery.d.ts.map