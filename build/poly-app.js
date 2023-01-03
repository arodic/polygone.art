var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { MenuOptions, IoNavigator, IoThemeSingleton, Property, RegisterIoElement, IoStorage as $ } from 'io-gui';
import './poly-artist-list.js';
import './poly-gallery.js';
import './poly-icons.js';
import './poly-model-view.js';
import './poly-thumbnail.js';
IoThemeSingleton.ioSpacing = 8;
IoThemeSingleton.ioFontSize = 15;
IoThemeSingleton.ioBorderRadius = 0;
export const BLOB_URL = 'https://blob.polygone.art';
const PAGE = $({ key: 'page', storage: 'hash', value: 'About' });
const PAGE_OPTIONS = new MenuOptions(['About', 'Catalog', 'Model', 'Artists'], { path: PAGE });
const TYPE = $({ key: 'type', storage: 'hash', value: 'All Models' });
const TYPE_OPTIONS = new MenuOptions(['All Models', 'Tilt Brush', '3D Mesh'], { path: TYPE });
const SIZE = $({ key: 'size', storage: 'hash', value: 'Medium' });
const SIZE_OPTIONS = new MenuOptions([
    { label: 'X-Small', value: '32x32' },
    { label: 'Small', value: '64x64' },
    { label: 'Medium', value: '128x128' },
    { label: 'Large', value: '256x256' },
    { label: 'X-Large', value: '512x512' }
], { path: SIZE });
const FILTER = $({ key: 'filter', storage: 'hash', value: '' });
const FILTER_OPTIONS = new MenuOptions([
    { label: 'all', value: '' },
    'animals', 'architecture', 'art', 'culture', 'food', 'history', 'nature',
    'objects', 'people', 'scenes', 'science', 'tech', 'transport', 'travel',
], { path: FILTER });
export const GUID = $({ key: 'guid', storage: 'hash', value: '' });
let PolyApp = class PolyApp extends IoNavigator {
    static get Style() {
        return /* css */ `
      :host {
        background-color: var(--iotBackgroundColor);
      }
      :host .catalog {
        flex-direction: column;
        display: flex;
        flex: 1 1 auto;
        overflow: hidden;
      }
      :host .catalog > io-option-menu {
        display: block;
      }
      :host .catalog > .settings {
        display: flex;
        padding: var(--io-spacing);
        position: relative;
      }
      :host .catalog > .settings io-option-menu {
        padding: 0;
        margin-right: var(--io-spacing);
        width: 8em;
      }
      :host .filterInput {
        padding-right:var(--io-item-height);
        flex: 1 1 auto;
      }
      :host .filterInput:empty:before {
        content: '\\1F50D';
        white-space: pre;
        padding: 0 0.25em;
        visibility: visible;
        opacity: 0.33;
      }
      :host .filterButton {
        position: absolute;
        right: var(--io-spacing);
        margin: var(--io-border-width);
        height: calc(var(--io-item-height) - var(--io-border-width)  - var(--io-border-width));
      }
      :host .sizeButton {
        position: fixed;
        top: 0;
        right: 0;
        margin: var(--io-border-width);
        height: calc(var(--io-item-height) - var(--io-border-width)  - var(--io-border-width));
      }
      :host io-icon g {
        fill: var(--io-color);
      }
    `;
    }
    static get Listeners() {
        return {
            'thumbnail-clicked': 'onThumbnailClicked',
            'poly-link-clicked': 'onFilterClicked'
        };
    }
    changed() {
        super.changed();
        //   const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : '';
        //   await fetch(`${BLOB_URL}/page/${this.selected}${ref}`);
        if (PAGE.value !== 'Model') {
            GUID.value = '';
            TYPE.value = 'All Models';
            FILTER.value = '';
        }
        //   if (this.selected !== 'Catalog') {
        //     TYPE.first = 'All Models';
        //     FILTER.value = '';
        //   }
        //   if (this.selected === 'model') {
        //     this.options[1]._properties.get('selected').value = false;
        //     this.options[1].changed();
        //   }
    }
    onThumbnailClicked(event) {
        PAGE.value = 'Model';
        GUID.value = event.detail;
    }
    onFilterClicked(event) {
        TYPE.value = 'All Models';
        PAGE.value = 'Catalog';
        FILTER.value = event.detail;
    }
};
__decorate([
    Property(true)
], PolyApp.prototype, "cache", void 0);
__decorate([
    Property({ value: PAGE_OPTIONS })
], PolyApp.prototype, "options", void 0);
__decorate([
    Property({ value: [
            ['io-md-view', { id: 'About', src: './README.md' }],
            ['div', { id: 'Catalog', class: 'catalog' }, [
                    ['div', { class: 'settings' }, [
                            ['io-option-menu', { options: TYPE_OPTIONS, value: TYPE }],
                            ['io-string', { class: 'filterInput', value: FILTER, live: true }],
                            // ['div', [
                            //   ['io-button', {class: 'filterButton', label: '▾'}],
                            //   // ['io-context-menu', {options: FILTER_OPTIONS, value: FILTER, position: 'bottom'}],
                            // ]],
                            // ['div', {class: 'sizeButton'}, [
                            //   ['io-icon', {icon: 'poly:grid'}],
                            //   // ['io-context-menu', {options: SIZE_OPTIONS, value: SIZE, position: 'bottom'}],
                            // ]]
                        ]],
                    ['poly-gallery', { type: TYPE, filter: FILTER, size: SIZE }],
                ]],
            ['poly-model-view', { id: 'Model' }],
            ['poly-artist-list', { id: 'Artists', src: './data/users.csv' }],
        ] })
], PolyApp.prototype, "elements", void 0);
PolyApp = __decorate([
    RegisterIoElement
], PolyApp);
export { PolyApp };
//# sourceMappingURL=poly-app.js.map