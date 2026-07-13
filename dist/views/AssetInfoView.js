var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { div, h4, Property, Register, ReactiveElement, span } from '@io-gui/core';
import { ioButton } from '@io-gui/inputs';
import { AssetInfo } from '../models/AssetInfo';
import { polyLink } from '../poly-link';
import { BLOB_URL } from '../constants';
let AssetInfoView = class AssetInfoView extends ReactiveElement {
    static get Style() {
        return /* css */ `
      :host {
        
      }
      :host > * {
        position: relative;
        padding: var(--io_spacing3);
        color: var(--io_color);
      }
      :host .info {
        font-size: calc(0.86 * var(--io_fontSize));
        background: var(--io_bgColorStrong);
      }
      :host poly-link {
        display: inline-block;
        margin: 0 var(--io_spacing);
      }
      :host .info > span {
        display: block;
        opacity: 0.5;
      }
      :host .downloads > div {
        display: block;
      }
      :host io-button {
        display: inline-block;
        margin: 0 var(--io_spacing2) 0 0 !important;
        min-width: 120px;
      }
      :host .license {
        font-size: calc(0.98 * var(--io_fontSize));
        /* font-weight: bold; */
        border-top: var(--io_border);
        border-bottom: var(--io_border);
        margin-bottom: var(--io_spacing);
      }
      :host h4 {
        margin: var(--io_spacing3) 0;
      }
    `;
    }
    onDownloadClicked(value) {
        window.open(value, '_blank');
    }
    ready() {
        this.assetInfoMutated();
    }
    assetInfoMutated() {
        this.render([
            div({ class: 'info' }, [
                `${this.assetInfo.name} by `,
                polyLink({ value: this.assetInfo.authorId, label: this.assetInfo.authorName }),
                span(new Date(this.assetInfo.createTime).toDateString()),
            ]),
            div({ class: 'description' }, `${this.assetInfo.description || ''}`),
            div({ class: 'license' }, 'This content is published under a CC-BY license. You\'re free to use this as long as you credit the author.'),
            this.assetInfo.tags.length ?
                div({ class: 'tags' }, [
                    h4('Tags:'), ...this.assetInfo.tags.map((tag) => polyLink({ value: tag, label: tag }))
                ]) : null,
            this.assetInfo.formats.length ?
                div({ class: 'formats' }, [
                    h4('Downloads:'),
                    div(this.assetInfo.formats.map(format => ioButton({
                        label: `${format.formatType}`, icon: 'poly:download',
                        value: format.formatType === 'GLB' ?
                            `${BLOB_URL}/assets/${this.guid}/GLB/${format.root.relativePath}` :
                            `${BLOB_URL}/archives/${this.guid}/${this.guid}_${format.formatType}.zip`,
                        action: this.onDownloadClicked
                    })))
                ]) : null,
        ]);
    }
};
__decorate([
    Property({ type: AssetInfo })
], AssetInfoView.prototype, "assetInfo", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfoView.prototype, "guid", void 0);
AssetInfoView = __decorate([
    Register
], AssetInfoView);
export { AssetInfoView };
export const assetInfoView = function (props) {
    return AssetInfoView.vConstructor(props);
};
