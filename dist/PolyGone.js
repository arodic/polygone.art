var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, Register } from '@io-gui/core';
import { Menu } from '@io-gui/menus';
import { IoNavigator } from '@io-gui/navigation';
import { pageArtists } from './pages/PageArtists.js';
import { pageCatalog } from './pages/PageCatalog.js';
import { pageModel } from './pages/PageModel.js';
import { BLOB_URL } from './constants.js';
import { $FILTER, $GUID, $PAGE } from './routing.js';
const PAGE_OPTION = new Menu({
    selectedID: $PAGE,
    options: [
        { id: 'catalog', label: 'Polygone Catalog' },
        { id: 'artists', label: 'Artists' },
        { id: 'model', label: 'Model', hidden: true },
    ],
});
let PolyGone = class PolyGone extends IoNavigator {
    static get Style() {
        return /* css */ `
      :host {
        height: 100%;
        background-color: var(--io_bgColor);
      }
    `;
    }
    static get Listeners() {
        return {
            ...super.Listeners,
            'thumbnail-clicked': 'onThumbnailClicked',
            'poly-link-clicked': 'onFilterClicked',
        };
    }
    ready() {
        this.mutated();
    }
    modelMutated() {
        super.modelMutated();
        this.debounce(this.optionMutatedDebounced);
    }
    mutated() {
        super.mutated();
        if ($PAGE.value !== 'model') {
            $GUID.value = '';
        }
    }
    optionMutatedDebounced() {
        const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : '';
        fetch(`${BLOB_URL}/page/${$PAGE.value}${ref}`).catch(console.error);
    }
    onThumbnailClicked(event) {
        $PAGE.value = 'model';
        $GUID.value = event.detail;
    }
    onFilterClicked(event) {
        $PAGE.value = 'catalog';
        $FILTER.value = event.detail;
    }
};
__decorate([
    Property({ value: 'top', type: String, reflect: true })
], PolyGone.prototype, "menu", void 0);
__decorate([
    Property({ value: PAGE_OPTION })
], PolyGone.prototype, "model", void 0);
__decorate([
    Property('proactive')
], PolyGone.prototype, "caching", void 0);
__decorate([
    Property({
        value: [
            pageCatalog({ id: 'catalog' }),
            pageArtists({ id: 'artists' }),
            pageModel({ id: 'model', guid: $GUID }),
        ],
    })
], PolyGone.prototype, "elements", void 0);
PolyGone = __decorate([
    Register
], PolyGone);
export { PolyGone };
export const polyGone = function (props) {
    return PolyGone.vConstructor(props);
};
