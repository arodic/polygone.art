import { IoElement } from 'io-gui';
export declare class PolyThumbnail extends IoElement {
    static get Style(): string;
    guid: string;
    size: number;
    thumbnails: Record<string, string>;
    static get Listeners(): {
        click: string;
    };
    onClicked(): void;
    sizeChanged(): void;
    changed(): void;
}
//# sourceMappingURL=poly-thumbnail.d.ts.map