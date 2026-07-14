import { Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { ioThreeViewport } from '@io-gui/three'
import { WebGPURenderer } from 'three/webgpu'
import { AssetInfo } from '../models/AssetInfo'
import { assetInfoView } from '../views/AssetInfoView.js'
import { controlSwitch } from '../views/ControlSwitch.js'
import { ModelViewer } from '../applets/ModelViewer.js'
import { ModelViewerCameraTool } from '../tools/ModelViewerCameraTool.js'
import { BottomDrawer } from '../layout/BottomDrawer.js'
import { bottomDrawerSplit } from '../layout/BottomDrawerSplit.js'
import { installPixelRatioCap } from '../utils/pixelRatio.js'

const renderer = new WebGPURenderer({
  antialias: false,
  alpha: true,
  forceWebGL: true,
})
void renderer.init()

const CHROME_IDLE_MS = 3000

type PageModelProps = ReactiveElementProps & {
  guid: WithBinding<string>
}

const drawer = new BottomDrawer({ drawerSize: '360px' })

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
    :host control-switch {
      position: absolute;
      top: var(--io_fontSize);
      right: var(--io_fontSize);
      z-index: 3;
      opacity: 1;
      transition: opacity 0.35s ease;
    }
    :host[chromeidle] control-switch {
      opacity: 0;
      pointer-events: none;
    }
    `
  }

  // Proto listeners are bound before ready(); capture so stick stopPropagation still counts.
  static override get Listeners() {
    return {
      pointerdown: ['onChromeActivity', { capture: true }] as [string, AddEventListenerOptions],
      pointermove: ['onChromeActivity', { capture: true }] as [string, AddEventListenerOptions],
      wheel: ['onChromeActivity', { capture: true }] as [string, AddEventListenerOptions],
      keydown: 'onChromeActivity',
    }
  }

  @Property('')
  declare guid: string

  @Property({ type: AssetInfo, init: null })
  declare assetInfo: AssetInfo

  @Property({ type: ModelViewer, init: null })
  declare applet: ModelViewer

  @Property({ type: ModelViewerCameraTool, init: null })
  declare cameraTool: ModelViewerCameraTool

  @Property({ value: false, type: Boolean, reflect: true })
  declare chromeIdle: boolean

  // No field initializer — ready() runs during construction before class fields are assigned.
  private _chromeIdleTimer?: number

  ready() {
    this.assetInfo.guid = this.bind('guid')
    this.applet.assetInfo = this.assetInfo
    this.cameraTool = new ModelViewerCameraTool({
      applet: this.applet,
      chromeIdle: this.bind('chromeIdle'),
    })

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
            renderer,
          }),
          assetInfoView({ id: 'assetInfo', assetInfo: this.assetInfo, guid: this.bind('guid') }),
        ]
      }),
      controlSwitch({
        id: 'controlSwitch',
        value: this.cameraTool.bind('mode'),
      }),
    ])

    const viewport = this.querySelector('io-three-viewport')
    if (viewport) installPixelRatioCap(viewport as Parameters<typeof installPixelRatioCap>[0])
  }

  override connectedCallback() {
    super.connectedCallback()
    this.bumpChromeActivity()
  }

  onChromeActivity(event: Event) {
    // Ignore idle mouse hover; keep chrome awake during active drag / stick hold.
    if (event instanceof PointerEvent && event.type === 'pointermove' && event.buttons === 0) return
    this.bumpChromeActivity()
  }

  private bumpChromeActivity() {
    if (this.chromeIdle) this.chromeIdle = false
    window.clearTimeout(this._chromeIdleTimer)
    this._chromeIdleTimer = window.setTimeout(() => {
      this.chromeIdle = true
    }, CHROME_IDLE_MS)
  }

  override dispose() {
    window.clearTimeout(this._chromeIdleTimer)
    this.cameraTool?.dispose()
    this.applet?.dispose()
    super.dispose()
  }
}

export const pageModel = function(props: PageModelProps) {
  return PageModel.vConstructor(props)
}
