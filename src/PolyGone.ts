import { Property, Register, VDOMElement, div } from '@io-gui/core'
import { ioOption, Menu } from '@io-gui/menus'
import { ioButton, ioString } from '@io-gui/inputs'
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition } from '@io-gui/navigation'

import { pageArtists } from './pages/PageArtists.js'
import { pageCatalog } from './pages/PageCatalog.js'

import { pageModel } from './pages/PageModel.js'

import { BLOB_URL } from './constants.js'
import { $FILTER, $GUID, $PAGE, $SIZE } from './routing.js'

const PAGE_OPTION = new Menu({
  selectedID: $PAGE,
  options: [
    { id: 'catalog', label: 'Polygone Catalog' },
    { id: 'artists', label: 'Artists', hidden: true },
    { id: 'model', label: 'Model', hidden: true },
  ],
})

const SIZE_OPTION = new Menu({
  icon: 'poly:size',
  selectedID: $SIZE,
  options: [
    {id: '32', label: '32x32'},
    {id: '64', label: '64x64'},
    {id: '128', label: '128x128'},
    {id: '256', label: '256x256'},
  ],
})

@Register
export class PolyGone extends IoNavigator {
  static override get Style() {
    return /* css */`
      :host {
        height: 100%;
        background-color: var(--io_bgColor);
        --io_fontSize: 18px;
        --io_lineHeight: 22px;
        --io_fieldHeight: 28px;
      }
      :host > io-menu {
        padding: var(--io_spacing2) !important;
      }
      :host[page="catalog"] .settings {
        display: flex;
      }
      :host .settings {
        position: absolute;
        right: 0;
        display: none;
      }
      :host .filterInput {
        min-width: 12em;
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
      :host .settings > io-option {
        margin: 0 var(--io_spacing2);
      }
      :host .settings > io-option[selected] {
        border-color: transparent;
        background-color: inherit;
      }
      :host io-icon g {
        fill: var(--io_color);
      }
    `
  }

  @Property({value: 'top', type: String, reflect: true})
  declare menu: MenuPosition

  @Property({ value: PAGE_OPTION })
  declare model: Menu

  @Property('proactive')
  declare caching: CachingType

  @Property({
    value: [
      pageCatalog({ id: 'catalog' }),
      pageArtists({ id: 'artists' }),
      pageModel({ id: 'model', guid: $GUID }),
    ],
  })
  declare elements: VDOMElement[]

  static override get Listeners() {
    return {
      ...super.Listeners,
      'thumbnail-clicked': 'onThumbnailClicked',
      'poly-link-clicked': 'onFilterClicked',
    }
  }

  ready() {
    this.mutated()
    this.widget = div({ class: 'settings' }, [
      ioString({ class: 'filterInput', value: $FILTER, live: true, placeholder: 'Search 🔍' }),
      ioButton({ class: 'clearButton', icon: 'io:close', action: () => $FILTER.value = '' }),
      ioOption({ class: 'size-option', direction: 'down', model: SIZE_OPTION })
    ])
    this.modelMutated()
  }

  override modelMutated() {
    super.modelMutated()
    this.setAttribute('page', this.model.selectedID)
    this.debounce(this.optionMutatedDebounced)
  }

  override mutated() {
    super.mutated()
    if ($PAGE.value !== 'model') {
      $GUID.value = ''
    }
  }

  optionMutatedDebounced() {
    const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : ''
    fetch(`${BLOB_URL}/page/${$PAGE.value}${ref}`).catch(console.error)
  }

  onThumbnailClicked(event: CustomEvent<string>) {
    $PAGE.value = 'model'
    $GUID.value = event.detail
  }

  onFilterClicked(event: CustomEvent<string>) {
    $PAGE.value = 'catalog'
    $FILTER.value = event.detail
  }
}

export const polyGone = function(props?: IoNavigatorProps) {
  return PolyGone.vConstructor(props)
}