import { Property, Register, Storage as $, VDOMElement, DispatchTiming } from '@io-gui/core'
import { ioMarkdown } from '@io-gui/markdown'
import { MenuOption } from '@io-gui/menus'
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition, SelectType } from '@io-gui/navigation'
import { polyPageGallery } from './poly-page-gallery.js'
import { polyPageModelView } from './poly-page-model-view.js'
import { polyPageArtistList } from './poly-page-artist-list.js'
import './poly-icons.js'
import { BLOB_URL } from './constants.js'

const $PAGE = $({ key: 'page', storage: 'hash', value: 'about' })
const PAGE_OPTION = new MenuOption({
  selectedID: $PAGE,
  options: [
    { id: 'about', value: 'About' },
    { id: 'catalog', value: 'Catalog' },
    { id: 'artists', value: 'Artists' },
    { id: 'model', value: 'Model', hidden: true },
  ],
})

const $GUID = $({ key: 'guid', storage: 'hash', value: '' })

@Register
export class PolyApp extends IoNavigator {
  static override get Style() {
    return /* css */`
      :host {
        background-color: var(--io_bgColor);
      }
    `
  }

  @Property({value: 'top', type: String, reflect: true})
  declare menu: MenuPosition

  @Property({ value: PAGE_OPTION })
  declare option: MenuOption

  @Property('deep')
  declare select: SelectType

  @Property('proactive')
  declare caching: CachingType

  @Property({value: 'debounced'})
  declare dispatchTiming: DispatchTiming

  @Property({
    value: [
      ioMarkdown({ id: 'about', src: './README.md' }),
      polyPageGallery({ id: 'catalog' }),
      polyPageModelView({ id: 'model', guid: $GUID }),
      polyPageArtistList({ id: 'artists', src: `${BLOB_URL}/data/artists.csv` }),
    ],
  })
  declare elements: VDOMElement[]

  static override get Listeners() {
    return {
      ...super.Listeners,
      'thumbnail-clicked': 'onThumbnailClicked',
      // 'poly-link-clicked': 'onFilterClicked',
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

  // onFilterClicked(event: CustomEvent<string>) {
  //   console.log(event.detail)
  //   $TYPE.value = 'all'
  //   $PAGE.value = 'catalog'
  //   $FILTER.value = event.detail
  // }
}

export const polyApp = function(props?: IoNavigatorProps) {
  return PolyApp.vConstructor(props)
}