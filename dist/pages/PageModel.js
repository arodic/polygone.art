var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, ReactiveElement, Register } from '@io-gui/core';
import { ioThreeViewport } from '@io-gui/three';
import { AssetInfo } from '../models/AssetInfo';
import { assetInfoView } from '../views/AssetInfoView.js';
import { ModelViewer } from '../applets/ModelViewer.js';
import { ModelViewerCameraTool } from '../tools/ModelViewerCameraTool.js';
import { BottomDrawer } from '../layout/BottomDrawer.js';
import { bottomDrawerSplit } from '../layout/BottomDrawerSplit.js';
const drawer = new BottomDrawer({ drawerSize: '330px' });
let PageModel = class PageModel extends ReactiveElement {
    static get Style() {
        return /* css */ `
    :host {
      position: relative;
      display: flex;
      overflow: hidden;
      height: 100%;
      width: 100%;
    }
    :host bottom-drawer-split .main io-three-viewport {
      width: 100%;
      height: 100%;
    }
    :host bottom-drawer-split .drawer-panel {
      background-color: color-mix(in srgb, var(--io_bgColorStrong) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    :host asset-info-view .info {
      background: transparent;
    }
    `;
    }
    ready() {
        this.assetInfo.guid = this.bind('guid');
        this.applet.assetInfo = this.assetInfo;
        this.cameraTool = new ModelViewerCameraTool({ applet: this.applet });
        this.render([
            bottomDrawerSplit({
                id: 'layout',
                model: drawer,
                revealSelector: '.info',
                elements: [
                    ioThreeViewport({
                        id: 'model',
                        applet: this.applet,
                        cameraSelect: 'scene',
                        tool: this.cameraTool,
                    }),
                    assetInfoView({ id: 'assetInfo', assetInfo: this.assetInfo, guid: this.bind('guid') }),
                ]
            })
        ]);
    }
};
__decorate([
    Property('')
], PageModel.prototype, "guid", void 0);
__decorate([
    Property({ type: AssetInfo, init: null })
], PageModel.prototype, "assetInfo", void 0);
__decorate([
    Property({ type: ModelViewer, init: null })
], PageModel.prototype, "applet", void 0);
__decorate([
    Property({ type: ModelViewerCameraTool, init: null })
], PageModel.prototype, "cameraTool", void 0);
PageModel = __decorate([
    Register
], PageModel);
export { PageModel };
export const pageModel = function (props) {
    return PageModel.vConstructor(props);
};
