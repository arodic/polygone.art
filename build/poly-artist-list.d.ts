import { IoElement } from 'io-gui';
import './poly-link.js';
type User = {
    name: string;
    assets: string[];
};
export declare class PolyArtistList extends IoElement {
    static get Style(): string;
    src: string;
    users: Record<string, User>;
    ids: string[];
    static get Listeners(): {
        scroll: string;
    };
    srcChanged(): void;
    connectedCallback(): void;
    onResized(): void;
    onScroll(): void;
    updateVirualList(): void;
    changed(): void;
}
export {};
//# sourceMappingURL=poly-artist-list.d.ts.map