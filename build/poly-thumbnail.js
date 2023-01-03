var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { IoElement, RegisterIoElement, Property } from 'io-gui';
const cachedId = [];
const queue = [];
setInterval(() => {
    if (queue.length) {
        const i = Math.floor(Math.random() * queue.length);
        queue[i].$.image.style.setProperty('background-image', `url("./assets/${queue[i].guid}/thumbnail-${queue[i].size}.jpg")`);
        cachedId.push(queue[i].guid);
        queue.splice(i, 1);
    }
}, 1);
let PolyThumbnail = class PolyThumbnail extends IoElement {
    static get Style() {
        return /* css */ `
    :host {
      border: 1px solid black;
      box-sizing: border-box;
      display: inline-block;
      float: left;
      color: rgba(0, 0, 0, 0.1);
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
    }
    :host div {
      white-space: nowrap;
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
            'click': 'onClicked'
        };
    }
    onClicked() {
        this.dispatchEvent('thumbnail-clicked', this.guid, true);
    }
    sizeChanged() {
        if (cachedId.indexOf(this.guid) !== -1) {
            cachedId.splice(cachedId.indexOf(this.guid), 1);
        }
    }
    changed() {
        this.template([['div', { $: 'image' }]]);
        if (this.thumbnails[this.guid]) {
            this.style.setProperty('background-image', `url("data:image/jpeg;base64,${this.thumbnails[this.guid]}")`);
        }
        else {
            this.style.setProperty('background-image', '');
        }
        if (this.size === 32) {
            this.$.image && this.$.image.style.setProperty('background-image', '');
        }
        else {
            if (cachedId.indexOf(this.guid) !== -1) {
                this.$.image && this.$.image.style.setProperty('background-image', `url("./assets/${this.guid}/thumbnail-${this.size}.jpg")`);
            }
            else {
                this.$.image && this.$.image.style.setProperty('background-image', '');
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
    Property({ type: Object, observe: true })
], PolyThumbnail.prototype, "thumbnails", void 0);
PolyThumbnail = __decorate([
    RegisterIoElement
], PolyThumbnail);
export { PolyThumbnail };
//# sourceMappingURL=poly-thumbnail.js.map