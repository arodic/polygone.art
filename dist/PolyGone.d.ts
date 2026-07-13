import { VDOMElement } from '@io-gui/core';
import { Menu } from '@io-gui/menus';
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition } from '@io-gui/navigation';
export declare class PolyGone extends IoNavigator {
    static get Style(): string;
    menu: MenuPosition;
    model: Menu;
    caching: CachingType;
    elements: VDOMElement[];
    static get Listeners(): {
        'thumbnail-clicked': string;
        'poly-link-clicked': string;
        'io-drawer-expanded-changed': string;
    };
    ready(): void;
    modelMutated(): void;
    mutated(): void;
    optionMutatedDebounced(): void;
    onThumbnailClicked(event: CustomEvent<string>): void;
    onFilterClicked(event: CustomEvent<string>): void;
}
export declare const polyGone: (props?: IoNavigatorProps) => VDOMElement;
