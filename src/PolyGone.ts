import { Property, Register, VDOMElement } from '@io-gui/core'
import { MenuOption } from '@io-gui/menus'
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition } from '@io-gui/navigation'

import { pageArtists } from './pages/PageArtists.js'
import { pageCatalog } from './pages/PageCatalog.js'

import { pageModel } from './pages/PageModel.js'

import { BLOB_URL } from './constants.js'
import { $FILTER, $GUID, $PAGE } from './routing.js'

const PAGE_OPTION = new MenuOption({
  selectedID: $PAGE,
  options: [
    { id: 'catalog', label: 'Polygone Catalog' },
    { id: 'artists', label: 'Artists' },
    { id: 'model', label: 'Model', hidden: true },
  ],
})

@Register
export class PolyGone extends IoNavigator {
  static override get Style() {
    return /* css */`
      :host {
        height: 100%;
        background-color: var(--io_bgColor);
      }
    `
  }

  @Property({value: 'top', type: String, reflect: true})
  declare menu: MenuPosition

  @Property({ value: PAGE_OPTION })
  declare option: MenuOption

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
  }

  optionMutated() {
    super.optionMutated()
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