 
import { Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { ioSplit, Split } from '@io-gui/layout'
import { ioThreeViewport } from '@io-gui/three'
import { AssetInfo } from '../models/AssetInfo'
import { assetInfoView } from '../views/AssetInfoView.js'
import { ModelViewer } from '../applets/ModelViewer.js'

type PageModelProps = ReactiveElementProps & {
  guid: WithBinding<string>
}

const split = new Split({
  type: 'split', orientation: 'horizontal',
  children: [
    { type: 'panel', size: 'auto', tabs: [{id: 'model', label: 'Model'}] },
    { type: 'panel', size: '330px', tabs: [{id: 'assetInfo', label: 'Model Info'}] }
  ]
})

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
    }
    :host io-tabs {
      display: none;
    }
    `
  }

  @Property('')
  declare guid: string

  @Property({ type: AssetInfo, init: null })
  declare assetInfo: AssetInfo

  @Property({ type: ModelViewer, init: null })
  declare applet: ModelViewer

  ready() {

    this.assetInfo.guid = this.bind('guid')
    this.applet.assetInfo = this.assetInfo

    this.render([
      ioSplit({
        id: 'split',
        model: split,
        elements: [
          ioThreeViewport({id: 'model', applet: this.applet, cameraSelect: 'scene'}),
          assetInfoView({ id: 'assetInfo', assetInfo: this.assetInfo, guid: this.bind('guid') }),
        ]
      })
    ])
  }

  onResized() {
    const rect = this.getBoundingClientRect()
    const aspect = rect.width / rect.height
    if (aspect > 1) {
      split.orientation = 'horizontal'
    } else {
      split.orientation = 'vertical'
    }
  }
}

export const pageModel = function(props: PageModelProps) {
  return PageModel.vConstructor(props)
}