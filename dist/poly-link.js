var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, ReactiveElement, Register } from '@io-gui/core';
let PolyLink = class PolyLink extends ReactiveElement {
    static get Style() {
        return /* css */ `
      :host {
        color: var(--io_colorBlue);
        height: var(--io_lineHeight);
        line-height: var(--io_lineHeight);
        cursor: pointer;
      }
      :host:hover {
        text-decoration: underline;
      }
    `;
    }
    static get Listeners() {
        return {
            click: 'onClicked',
        };
    }
    constructor(props) {
        super(props);
        this._flattenTextNode(this);
    }
    labelChanged() {
        this._flattenTextNode(this);
        this._textNode.nodeValue = String(this.label || '');
    }
    onClicked() {
        this.dispatch('poly-link-clicked', this.value, true);
    }
};
__decorate([
    Property('')
], PolyLink.prototype, "value", void 0);
__decorate([
    Property('')
], PolyLink.prototype, "label", void 0);
PolyLink = __decorate([
    Register
], PolyLink);
export { PolyLink };
export const polyLink = function (props) {
    return PolyLink.vConstructor(props);
};
