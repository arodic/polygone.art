import { VDOMElement } from '@io-gui/core';
import { MenuOption } from '@io-gui/menus';
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition, SelectType } from '@io-gui/navigation';
import './poly-icons.js';
export declare const BLOB_URL = "https://blob.polygone.art";
export declare class PolyApp extends IoNavigator {
    static get Style(): string;
    menu: MenuPosition;
    option: MenuOption;
    select: SelectType;
    caching: CachingType;
    elements: VDOMElement[];
    static get Listeners(): {
        'thumbnail-clicked': string;
        'poly-link-clicked': string;
        'io-drawer-expanded-changed': string;
    };
    ready(): void;
    mutated(): void;
    onThumbnailClicked(event: CustomEvent<string>): void;
    onFilterClicked(event: CustomEvent<string>): void;
}
export declare const polyApp: (props?: IoNavigatorProps) => VDOMElement;
