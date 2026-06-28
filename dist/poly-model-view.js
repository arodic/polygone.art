var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { createVDOMElement, div, h4, li, Property, ReactiveElement, Register, span, ul, a } from '@io-gui/core';
import { BLOB_URL } from './poly-app.js';
import { polyLink } from './poly-link.js';
const cachedAssets = {};
let PolyModelView = class PolyModelView extends ReactiveElement {
    static get Style() {
        return /* css */ `
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      padding: var(--io_spacing3) var(--io_lineHeight);
      line-height: 1.4em;
      max-width: 512px;
      color: var(--io_color);
    }
    :host model-viewer {
      width: 100%;
      height: var(--polyViewerHeight);
    }
    :host .info {
      background: var(--io_bgColorStrong);
      padding: var(--io_spacing);
      margin: 0;
    }
    :host .description {
      padding: var(--io_spacing) 0;
    }
    :host .license {
      border-top: var(--io_border);
      border-bottom: var(--io_border);
      padding: var(--io_spacing) 0;
      margin-bottom: var(--io_spacing);
    }
    :host .info :last-child {
      float: right;
      opacity: 0.5;
    }
    :host h4 {
      margin: 0;
    }
    :host .downloads,
    :host .tags {
      margin: 0;
      padding: 0.5em;
    }
    :host .downloads > li,
    :host .tags > li {
      display: inline-block;
      margin-right: 0.5em;
    }
    `;
    }
    onResized() {
        const height = Math.min(this.clientWidth, 512) / 1.333;
        this.style.setProperty('--polyViewerHeight', `${height}px`);
    }
    guidChanged() {
        if (cachedAssets[this.guid]) {
            this.assetInfo = cachedAssets[this.guid];
            this.mutated();
        }
        else if (this.guid) {
            fetch(`${BLOB_URL}/assets/${this.guid}/data.json`).then(async (response) => {
                const assetInfo = await response.json();
                this.assetInfo = assetInfo;
                cachedAssets[this.guid] = assetInfo;
                this.mutated();
            });
            fetch(`${BLOB_URL}/guid/${this.guid}`);
        }
        else {
            this.assetInfo = null;
            this.mutated();
        }
    }
    mutated() {
        if (!this.assetInfo) {
            this.render([]);
            return;
        }
        const gltf2model = this.assetInfo.formats.find((format) => format.formatType === 'GLTF2');
        const fltf2Root = gltf2model?.root?.relativePath;
        const modelViewer = createVDOMElement('model-viewer', {
            id: 'reveal',
            poster: `${BLOB_URL}/assets/${this.guid}/thumbnail-512.jpg`,
            alt: this.assetInfo.description || this.assetInfo.name,
            environmentImage: 'neutral',
            autoRotate: true,
            cameraControls: true,
            src: fltf2Root ? `${BLOB_URL}/assets/${this.guid}/GLTF2/${fltf2Root}` : '',
            style: {
                'background-color': this.assetInfo?.presentationParams?.backgroundColor || '#000000',
            },
        }, []);
        this.render([
            modelViewer,
            div({ class: 'info' }, [
                span(`${this.assetInfo.name} by `),
                polyLink({ value: this.assetInfo.authorId, label: this.assetInfo.authorName }),
                span(new Date(this.assetInfo.createTime).toDateString()),
            ]),
            div({ class: 'description' }, `${this.assetInfo.description || ''}`),
            div({ class: 'license' }, 'This content is published under a CC-BY license. You\'re free to use this as long as you credit the author.'),
            this.assetInfo.tags.length ? h4('Tags:') : null,
            ul({ class: 'tags' }, this.assetInfo.tags.map((tag) => li([
                polyLink({ value: tag, label: tag }),
            ]))),
            h4('Downloads:'),
            ul({ class: 'downloads' }, this.assetInfo.formats.map((format) => li([
                a({ href: `${BLOB_URL}/archives/${this.guid}/${this.guid}_${format.formatType}.zip` }, `${format.formatType} ⇩`),
            ]))),
        ]);
    }
};
__decorate([
    Property('')
], PolyModelView.prototype, "guid", void 0);
__decorate([
    Property({ value: null })
], PolyModelView.prototype, "assetInfo", void 0);
PolyModelView = __decorate([
    Register
], PolyModelView);
export { PolyModelView };
export const polyModelView = function (props) {
    return PolyModelView.vConstructor(props);
};
