 
import { div, Property, ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'
import { ioButton, ioString } from '@io-gui/inputs'
import { ioMenuItem, ioOptionSelect, MenuOption } from '@io-gui/menus'
import { catalogGrid } from './CatalogGrid.js'
import { BLOB_URL } from '../constants.js'
import { $SIZE, $TYPE, $FILTER } from '../routing.js'

const TYPE_OPTION = new MenuOption({
  options: [
    {id: 'all', label: 'All Models'},
    {id: 'tilt', label: 'Tilt Brush'},
    {id: '3d', label: '3D Mesh'},
  ],
})

const SIZE_OPTION = new MenuOption({
  icon: 'poly:grid',
  selectedID: $SIZE,
  options: [
    {id: '32', label: '32x32'},
    {id: '64', label: '64x64'},
    {id: '128', label: '128x128'},
    {id: '256', label: '256x256'},
    {id: '512', label: '512x512'},
  ],
})

const FILTER_OPTION = new MenuOption({
  id: 'root',
  label: '',
  icon: 'poly:filter',
  selectedID: $FILTER,
  options: [
    { id: '', label: 'all', value: '' },
    'animals',
    'architecture',
    'art',
    'culture',
    'food',
    'history',
    'nature',
    'objects',
    'people',
    'scenes',
    'science',
    'tech',
    'transport',
    'travel',
  ],
})

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
      :host .settings {
        display: flex;
        padding: var(--io_spacing2);
        border-bottom: 1px solid var(--io_borderColor);
      }
      :host .settings io-option-select {
        padding: 0 0.2em 0 0.8em;
        margin-right: var(--io_spacing2);
        width: 7.5em;
      }
      :host .filterInput {
        padding-right: var(--io_fieldHeight);
        flex: 1 1 auto;
      }
      :host .clearButton {
        --io_lineHeight: var(--io_fontSize);
        position: relative;
        left: calc(var(--io_fieldHeight) * -1);
        margin-right: calc(var(--io_fieldHeight) * -1);
        border-color: transparent !important;
        background: transparent !important;
        box-shadow: none !important;
        display: flex;
        align-items: center;
        z-index: 1;
      }
      :host .settings > io-menu-item {
        margin: 0 var(--io_spacing2);
      }
      :host .settings > io-menu-item[selected] {
        border-color: transparent;
        background-color: inherit;
      }
      :host io-icon g {
        fill: var(--io_color);
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
    this.render([
      div({ class: 'settings' }, [
        ioOptionSelect({ option: TYPE_OPTION, value: $TYPE }),
        ioString({ class: 'filterInput', value: $FILTER, live: true, placeholder: 'Search' }),
        ioButton({ class: 'clearButton', icon: 'io:close', action: () => $FILTER.value = '' }),
        ioMenuItem({ direction: 'down', option: SIZE_OPTION }),
        ioMenuItem({ direction: 'down', option: FILTER_OPTION }),
      ]),
      catalogGrid({
        id: 'catalog',
        size: $SIZE,
        type: $TYPE,
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