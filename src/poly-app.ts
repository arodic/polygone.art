import {MenuOptions, MenuItem, IoNavigator, IoThemeSingleton, Property, RegisterIoElement, VDOMArray, IoStorage as $} from 'io-gui';
import './poly-artist-list.js';
import './poly-gallery.js';
import './poly-icons.js';
import './poly-model-view.js';
import './poly-thumbnail.js';

IoThemeSingleton.ioSpacing = 8;
IoThemeSingleton.ioFontSize = 15;
IoThemeSingleton.ioBorderRadius = 0;

export const BLOB_URL = 'https://blob.polygone.art';

const $PAGE = $({key: 'page', storage: 'hash', value: 'About'});
const PAGE_OPTIONS = new MenuOptions([
  {value: 'About'},
  {value: 'Catalog'},
  {value: 'Model', hidden: true},
  {value: 'Artists'}
], {path: $PAGE} as any);

const $TYPE = $({key: 'type', storage: 'hash', value: 'All Models'});
const TYPE_OPTIONS = new MenuOptions([
  'All Models',
  'Tilt Brush',
  '3D Mesh'
], {path: $TYPE} as any);

const $SIZE = $({key: 'size', storage: 'hash', value: '128x128'});
const SIZE_OPTIONS = new MenuOptions([
  '32x32',
  '64x64',
  '128x128',
  '256x256',
  '512x512'
], {first: $SIZE} as any);

const $FILTER = $({key: 'filter', storage: 'hash', value: ''});
const FILTER_OPTIONS = new MenuOptions([
  {label: 'all', value: ''},
  'animals', 'architecture', 'art', 'culture', 'food', 'history', 'nature',
  'objects', 'people', 'scenes', 'science', 'tech', 'transport', 'travel',
], {first: $FILTER} as any);

const $GUID = $({key: 'guid', storage: 'hash', value: ''});

@RegisterIoElement
export class PolyApp extends IoNavigator {
  static get Style() {
    return /* css */`
      :host {
        background-color: var(--iotBackgroundColor);
      }
      :host .catalog {
        flex-direction: column;
        display: flex;
        flex: 1 1 auto;
        overflow: hidden;
      }
      :host .catalog > io-option-menu {
        display: block;
      }
      :host .catalog > .settings {
        display: flex;
        padding: var(--iotSpacing);
        position: relative;
      }
      :host .catalog > .settings io-option-menu {
        padding: 0;
        margin-right: var(--iotSpacing);
        width: 8em;
      }
      :host .catalog > .settings > .filterInput {
        padding-right:var(--iotFieldHeight);
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
        fill: var(--iotColor);
      }
    `;
  }

  @Property(true)
  declare cache: boolean;

  @Property({value: PAGE_OPTIONS})
  declare options: MenuOptions;

  @Property({value: [
    ['io-md-view', {id: 'About', src: './README.md'}],
    ['div', {id: 'Catalog', class: 'catalog'}, [
      ['div', {class: 'settings'}, [
        ['io-option-menu', {options: TYPE_OPTIONS, value: $TYPE}],
        ['io-string', {class: 'filterInput', value: $FILTER, live: true}],
        ['io-menu-item', {
          direction: 'down',
          item: new MenuItem({
            label: '',
            icon: 'poly:filter',
            first: $FILTER,
            options: FILTER_OPTIONS,
          })
        }],
        ['io-menu-item', {
          direction: 'down',
          item: new MenuItem({
            label: '',
            icon: 'poly:grid',
            first: $SIZE,
            options: SIZE_OPTIONS,
          })
        }]
      ]],
      ['poly-gallery', {
        assetsSrc: './data/assets.csv',
        thumbsSrc: './data/thumbs.csv',
        type: $TYPE, filter: $FILTER, size: $SIZE
      }],
    ]],
    ['poly-model-view', {
      id: 'Model',
      guid: $GUID,
    }],
    ['poly-artist-list', {id: 'Artists', src: './data/users.csv'}],
  ]})
  declare elements: VDOMArray[];

  static get Listeners(): any {
    return {
      'thumbnail-clicked': 'onThumbnailClicked',
      'poly-link-clicked': 'onFilterClicked'
    };
  }
  changed() {
    super.changed();
    const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : '';
    fetch(`${BLOB_URL}/page/${this.selected}${ref}`).catch(console.error);

    if ($PAGE.value !== 'Model') {
      $GUID.value = '';
      $TYPE.value = 'All Models';
      $FILTER.value = '';
    }
  }
  onThumbnailClicked(event: CustomEvent) {
    $PAGE.value = 'Model';
    $GUID.value = event.detail;
  }
  onFilterClicked(event: CustomEvent) {
    $TYPE.value = 'All Models';
    $PAGE.value = 'Catalog';
    $FILTER.value = event.detail;
  }
}