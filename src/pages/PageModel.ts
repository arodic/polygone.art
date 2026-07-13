 
import { Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { ioThreeViewport } from '@io-gui/three'
import { AssetInfo } from '../models/AssetInfo'
import { assetInfoView } from '../views/AssetInfoView.js'
import { ModelViewer } from '../applets/ModelViewer.js'
import { ModelViewerCameraTool } from '../tools/ModelViewerCameraTool.js'
import { BottomDrawer } from '../layout/BottomDrawer.js'
import { bottomDrawerSplit } from '../layout/BottomDrawerSplit.js'

type PageModelProps = ReactiveElementProps & {
  guid: WithBinding<string>
}

const drawer = new BottomDrawer({ drawerSize: '240px' })

@Register
export class PageModel extends ReactiveElement {
  static override get Style() {
    return /* css */`
    :host {
      position: relative;
      display: flex;
      overflow: hidden;
      height: 100%;
      width: 100%;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host bottom-drawer-split .main io-three-viewport {
      width: 100%;
      height: 100%;
      outline: none;
      -webkit-user-select: none;
      user-select: none;
      -webkit-touch-callout: none;
      -webkit-tap-highlight-color: transparent;
    }
    :host bottom-drawer-split .main io-three-viewport:focus,
    :host bottom-drawer-split .main io-three-viewport:focus-visible {
      outline: none;
    }
    :host bottom-drawer-split .drawer-panel {
      background-color: color-mix(in srgb, var(--io_bgColorStrong) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    :host asset-info-view .info {
      background: transparent;
    }
    `
  }

  @Property('')
  declare guid: string

  @Property({ type: AssetInfo, init: null })
  declare assetInfo: AssetInfo

  @Property({ type: ModelViewer, init: null })
  declare applet: ModelViewer

  @Property({ type: ModelViewerCameraTool, init: null })
  declare cameraTool: ModelViewerCameraTool

  ready() {

    this.assetInfo.guid = this.bind('guid')
    this.applet.assetInfo = this.assetInfo
    this.cameraTool = new ModelViewerCameraTool({ applet: this.applet })

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
    ])
  }
}

export const pageModel = function(props: PageModelProps) {
  return PageModel.vConstructor(props)
}
