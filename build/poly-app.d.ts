import { MenuOptions, IoNavigator, VDOMArray } from 'io-gui';
import './poly-artist-list.js';
import './poly-gallery.js';
import './poly-icons.js';
import './poly-model-view.js';
import './poly-thumbnail.js';
export declare const BLOB_URL = "https://blob.polygone.art";
export declare const GUID: import("io-gui").Binding;
export declare class PolyApp extends IoNavigator {
    static get Style(): string;
    cache: boolean;
    options: MenuOptions;
    elements: VDOMArray[];
    static get Listeners(): any;
    changed(): void;
    onThumbnailClicked(event: CustomEvent): void;
    onFilterClicked(event: CustomEvent): void;
}
//# sourceMappingURL=poly-app.d.ts.map