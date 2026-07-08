 
import { ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'
import { ioMarkdown } from '@io-gui/markdown'
import { ioSplit, Split } from '@io-gui/layout'
import { catalogView } from '../views/CatalogView'

const split = new Split({
  type: 'split', orientation: 'horizontal',
  children: [
    { type: 'panel', size: 'auto', tabs: [{id: 'catalog', label: 'Catalog'}] },
    { type: 'panel', size: '430px', tabs: [{id: 'about', label: 'About'}] }
  ]
})

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
    :host io-tabs {
      display: none;
    }
    `
  }

  ready() {
    this.render([
      ioSplit({
        id: 'split',
        model: split,
        elements: [
          catalogView({ id: 'catalog' }),
          ioMarkdown({ id: 'about', src: './README.md' }),
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

export const pageCatalog = function(props: ReactiveElementProps) {
  return PageCatalog.vConstructor(props)
}