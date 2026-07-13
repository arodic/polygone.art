var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { ReactiveElement, Register } from '@io-gui/core';
import { ioMarkdown } from '@io-gui/markdown';
import { catalogView } from '../views/CatalogView';
import { BottomDrawer } from '../layout/BottomDrawer.js';
import { bottomDrawerSplit } from '../layout/BottomDrawerSplit.js';
const drawer = new BottomDrawer({ drawerSize: '430px' });
let PageCatalog = class PageCatalog extends ReactiveElement {
    static get Style() {
        return /* css */ `
    :host {
      position: relative;
      display: flex;
      overflow: hidden;
      height: 100%;
      width: 100%;
    }
    :host bottom-drawer-split .drawer-panel {
      background-color: color-mix(in srgb, var(--io_bgColorStrong) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    :host io-markdown {
      background-color: transparent;
    }
    `;
    }
    ready() {
        this.render([
            bottomDrawerSplit({
                id: 'layout',
                model: drawer,
                revealSelector: 'h1',
                elements: [
                    catalogView({ id: 'catalog' }),
                    ioMarkdown({ id: 'about', src: './README.md' }),
                ]
            })
        ]);
    }
};
PageCatalog = __decorate([
    Register
], PageCatalog);
export { PageCatalog };
export const pageCatalog = function (props) {
    return PageCatalog.vConstructor(props);
};
