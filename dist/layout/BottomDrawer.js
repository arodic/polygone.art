var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, ReactiveObject, Register } from '@io-gui/core';
let BottomDrawer = class BottomDrawer extends ReactiveObject {
    constructor(data = {}) {
        super();
        if (data.drawerSize !== undefined) {
            this.drawerSize = data.drawerSize;
        }
    }
};
__decorate([
    Property({ type: String, value: '330px' })
], BottomDrawer.prototype, "drawerSize", void 0);
BottomDrawer = __decorate([
    Register
], BottomDrawer);
export { BottomDrawer };
