var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { div, Property, ReactiveElement, Register } from '@io-gui/core';
const cachedId = [];
const queue = [];
setInterval(() => {
    if (queue.length) {
        const i = Math.floor(Math.random() * queue.length);
        if (!queue[i]._disposed && queue[i].$.image) {
            // queue[i].$.image.style.setProperty('background-image', `url("${BLOB_URL}/assets/${queue[i].guid}/thumbnail-${queue[i].size}.jpg")`)
            // cachedId.push(queue[i].guid)
        }
        // queue.splice(i, 1)
    }
}, 10);
let PolyThumbnail = class PolyThumbnail extends ReactiveElement {
    static get Style() {
        return /* css */ `
      :host {
        box-sizing: border-box;
        display: inline-block;
        float: left;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
      :host div {
        width: 100%;
        height: 100%;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
    `;
    }
    static get Listeners() {
        return {
            click: 'onClicked',
        };
    }
    onClicked() {
        this.dispatch('thumbnail-clicked', this.guid, true);
    }
    thumbnailsMutated() {
        this.mutated();
    }
    sizeChanged() {
        if (cachedId.indexOf(this.guid) !== -1) {
            cachedId.splice(cachedId.indexOf(this.guid), 1);
        }
    }
    mutated() {
        this.render([div({ id: 'image' })]);
        if (this.thumbnails?.[this.guid]) {
            this.style.setProperty('background-image', `url("data:image/jpeg;base64,${this.thumbnails[this.guid]}")`);
        }
        else {
            this.style.setProperty('background-image', '');
        }
        if (this.size === 32) {
            this.$.image?.style.setProperty('background-image', '');
        }
        else {
            if (cachedId.indexOf(this.guid) !== -1) {
                // this.$.image?.style.setProperty('background-image', `url("${BLOB_URL}/assets/${this.guid}/thumbnail-${this.size}.jpg")`)
            }
            else {
                this.$.image?.style.setProperty('background-image', '');
                if (queue.indexOf(this) !== -1)
                    queue.splice(queue.indexOf(this), 1);
                if (queue.indexOf(this) === -1)
                    queue.push(this);
            }
        }
    }
};
__decorate([
    Property('')
], PolyThumbnail.prototype, "guid", void 0);
__decorate([
    Property(256)
], PolyThumbnail.prototype, "size", void 0);
__decorate([
    Property({ type: Object, init: null })
], PolyThumbnail.prototype, "thumbnails", void 0);
PolyThumbnail = __decorate([
    Register
], PolyThumbnail);
export { PolyThumbnail };
export const polyThumbnail = function (props) {
    return PolyThumbnail.vConstructor(props);
};
