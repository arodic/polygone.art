 
import { Property, ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'
import { catalogGrid } from './CatalogGrid.js'
import { BLOB_URL } from '../constants.js'
import { $SIZE, $FILTER } from '../routing.js'

type CatalogViewProps = ReactiveElementProps & {}

@Register
export class CatalogView extends ReactiveElement {
  static override get Style() {
    return /* css */`
      :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
      }
    `
  }

  @Property('')
  declare size: string

  @Property('')
  declare type: string

  @Property('')
  declare filter: string

  override ready() {
    this.mutated()
  }

  override mutated() {
    console.log('CatalogView mutated')
    this.render([
      catalogGrid({
        id: 'catalog',
        size: $SIZE,
        filter: $FILTER,
        assetsSrc: `${BLOB_URL}/data/assets.csv`,
        thumbsSrc: `${BLOB_URL}/data/thumbs.csv`,
      }),
    ])
  }
}

export const catalogView = function(props: CatalogViewProps) {
  return CatalogView.vConstructor(props)
}