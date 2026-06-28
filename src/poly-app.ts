import { div, Property, Register, Storage as $, VDOMElement } from '@io-gui/core'
import { ioString } from '@io-gui/inputs'
import { ioMarkdown } from '@io-gui/markdown'
import { ioMenuItem, MenuOption, ioOptionSelect } from '@io-gui/menus'
import { CachingType, IoNavigator, IoNavigatorProps, MenuPosition, SelectType } from '@io-gui/navigation'
import { polyGallery } from './poly-gallery.js'
import { polyModelView } from './poly-model-view.js'
import { polyArtistList } from './poly-artist-list.js'
import './poly-icons.js'

export const BLOB_URL = 'https://blob.polygone.art'

const $PAGE = $({ key: 'page', storage: 'hash', value: 'about' })
const PAGE_OPTION = new MenuOption({
  selectedID: $PAGE,
  options: [
    { id: 'about', value: 'About' },
    { id: 'catalog', value: 'Catalog' },
    { id: 'artists', value: 'Artists' },
  ],
})

const $TYPE = $({ key: 'type', storage: 'hash', value: 'all' })
const TYPE_OPTION = new MenuOption({
  options: [
    {id: 'all', label: 'All Models'},
    {id: 'tilt', label: 'Tilt Brush'},
    {id: '3d', label: '3D Mesh'},
  ],
})

const $SIZE = $({ key: 'size', storage: 'hash', value: '32' })
// const SIZE_OPTION = new MenuOption({
//   icon: 'poly:grid',
//   selectedID: $SIZE,
//   options: [
//     {id: '32', label: '32x32'},
//     {id: '64', label: '64x64'},
//     {id: '128', label: '128x128'},
//     {id: '256', label: '256x256'},
//     {id: '512', label: '512x512'},
//   ],
// })

const $FILTER = $({ key: 'filter', storage: 'hash', value: '' })
const FILTER_OPTION = new MenuOption({
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

const $GUID = $({ key: 'guid', storage: 'hash', value: '' })

@Register
export class PolyApp extends IoNavigator {
  static override get Style() {
    return /* css */`
      :host {
        background-color: var(--io_bgColor);
      }
      :host .catalog {
        flex-direction: column;
        display: flex;
        flex: 1 1 auto;
        overflow: hidden;
      }
      :host .catalog > io-option-select {
        display: block;
      }
      :host .catalog > .settings {
        display: flex;
        padding: var(--io_spacing);
        position: relative;
      }
      :host .catalog > .settings io-option-select {
        padding: 0;
        margin-right: var(--io_spacing);
        width: 8em;
      }
      :host .catalog > .settings > .filterInput {
        padding-right: var(--io_fieldHeight);
        flex: 1 1 auto;
      }
      :host .catalog > .settings > io-menu-item > .hasmore {
        display: none;
      }
      :host .catalog > .settings > io-menu-item[selected] {
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
  declare option: MenuOption

  @Property('deep')
  declare select: SelectType

  @Property('proactive')
  declare caching: CachingType

  @Property({
    value: [
      ioMarkdown({ id: 'about', src: './README.md' }),
      div({ id: 'catalog', class: 'catalog' }, [
        div({ class: 'settings' }, [
          ioOptionSelect({ option: TYPE_OPTION, value: $TYPE }),
          ioString({ class: 'filterInput', value: $FILTER, live: true }),
          ioMenuItem({ direction: 'down', option: FILTER_OPTION }),
          // ioMenuItem({ direction: 'down', option: SIZE_OPTION }),
        ]),
        polyGallery({
          assetsSrc: `${BLOB_URL}/data/assets.csv`,
          thumbsSrc: `${BLOB_URL}/data/thumbs.csv`,
          type: $TYPE,
          filter: $FILTER,
          size: $SIZE,
        }),
      ]),
      polyModelView({
        id: 'model',
        guid: $GUID,
      }),
      polyArtistList({
        id: 'artists',
        src: `${BLOB_URL}/data/users.csv`
      }),
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

  override mutated() {
    super.mutated()
    const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : ''
    fetch(`${BLOB_URL}/page/${$PAGE.value}${ref}`).catch(console.error)

    if ($PAGE.value !== 'model') {
      $GUID.value = ''
    }
  }

  onThumbnailClicked(event: CustomEvent<string>) {
    $PAGE.value = 'model'
    $GUID.value = event.detail
  }

  onFilterClicked(event: CustomEvent<string>) {
    console.log(event.detail)
    $TYPE.value = 'all'
    $PAGE.value = 'catalog'
    $FILTER.value = event.detail
  }
}

export const polyApp = function(props?: IoNavigatorProps) {
  return PolyApp.vConstructor(props)
}