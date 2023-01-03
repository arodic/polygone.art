var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { IoElement, RegisterIoElement, Property } from 'io-gui';
let PolyLink = class PolyLink extends IoElement {
    static get Style() {
        return /* css */ `
      :host {
        color: var(--iotColorLink);
        height: var(--iotLineHeight);
        line-height: var(--iotLineHeight);
        cursor: pointer;
      }
      :host:hover {
        text-decoration: underline;
      }
    `;
    }
    static get Listeners() {
        return {
            'click': 'onClicked'
        };
    }
    onClicked() {
        if (this.value.search('://') !== -1) {
            const link = document.createElement('a');
            link.href = this.value;
            link.download = this.value.split('/').pop();
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        else {
            this.dispatchEvent('poly-link-clicked', this.value, true);
        }
    }
};
__decorate([
    Property('')
], PolyLink.prototype, "value", void 0);
PolyLink = __decorate([
    RegisterIoElement
], PolyLink);
export { PolyLink };
//# sourceMappingURL=poly-link.js.map