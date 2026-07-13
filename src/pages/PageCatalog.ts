 
import { ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'
import { ioMarkdown } from '@io-gui/markdown'
import { catalogView } from '../views/CatalogView'
import { BottomDrawer } from '../layout/BottomDrawer.js'
import { bottomDrawerSplit } from '../layout/BottomDrawerSplit.js'

const drawer = new BottomDrawer({ drawerSize: '420px' })

@Register
export class PageCatalog extends ReactiveElement {
  static override get Style() {
    return /* css */`
    :host {
      position: relative;
      display: flex;
      overflow: hidden;
      height: 100%;
      width: 100%;
    }
    :host bottom-drawer-split .drawer-panel {
      background-color: color-mix(in srgb, var(--io_bgColorStrong) 80%, transparent);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    :host io-markdown {
      background-color: transparent;
    }
    `
  }

  ready() {
    this.render([
      bottomDrawerSplit({
        id: 'layout',
        model: drawer,
        revealSelector: 'h1',
        elements: [
          catalogView({ id: 'catalog' }),
          ioMarkdown({ id: 'about', src: './README.md' }),
        ]
      })
    ])
  }
}

export const pageCatalog = function(props: ReactiveElementProps) {
  return PageCatalog.vConstructor(props)
}
