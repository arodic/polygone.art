import {Options, Path, IoSelectorTabs, IoThemeSingleton, Property, RegisterIoElement} from 'io-gui';
import './poly-artist-list.js';
import {$PAGE, $TYPE, $SIZE, $FILTER, $GUID, BLOB_URL} from './poly-env.js';
import './poly-gallery.js';
import './poly-icons.js';
import './poly-model-view.js';
import './poly-thumbnail.js';

IoThemeSingleton.ioSpacing = 8;
IoThemeSingleton.ioFontSize = 15;
IoThemeSingleton.ioBorderRadius = 0;

const NAVIGATION_OPTIONS = new Options([
  {label: 'About', value: 'about'},
  {label: 'Catalog', value: 'catalog'},
  {label: 'Artists', value: 'artists'},
], {
  path: new Path({string: $PAGE})
});

const TYPE_OPTIONS = new Options([
  {label: 'All Models', value: 'all'},
  {label: 'Tilt Brush', value: 'tilt'},
  {label: '3D Mesh', value: '!tilt'}
], {
  path: new Path({string: $TYPE})
});

const SIZE_OPTIONS = new Options([
  {label: 'X-Small', value: '32x32'},
  {label: 'Small', value: '64x64'},
  {label: 'Medium', value: '128x128'},
  {label: 'Large', value: '256x256'},
  {label: 'X-Large', value: '512x512'}
], {
  path: new Path({string: $SIZE})
});

const FILTER_OPTIONS = new Options([
  {label: 'All', value: ''},
  {label: 'animals', value: 'animals'},
  {label: 'architecture', value: 'architecture'},
  {label: 'art', value: 'art'},
  {label: 'culture', value: 'culture'},
  {label: 'food', value: 'food'},
  {label: 'history', value: 'history'},
  {label: 'nature', value: 'nature'},
  {label: 'objects', value: 'objects'},
  {label: 'people', value: 'people'},
  {label: 'scenes', value: 'scenes'},
  {label: 'science', value: 'science'},
  {label: 'tech', value: 'tech'},
  {label: 'transport', value: 'transport'},
  {label: 'travel', value: 'travel'},
], {
  path: new Path({string: $FILTER})
});

@RegisterIoElement
export class IoMainPage extends IoSelectorTabs {
  static get Style() {
    return /* css */`
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
        padding: var(--io-spacing);
        position: relative;
      }
      :host .catalog > .settings io-option-menu {
        padding: 0;
        margin-right: var(--io-spacing);
        width: 8em;
      }
      :host .filterInput {
        padding-right:var(--io-item-height);
        flex: 1 1 auto;
      }
      :host .filterInput:empty:before {
        content: '\\1F50D';
        white-space: pre;
        padding: 0 0.25em;
        visibility: visible;
        opacity: 0.33;
      }
      :host .filterButton {
        position: absolute;
        right: var(--io-spacing);
        margin: var(--io-border-width);
        height: calc(var(--io-item-height) - var(--io-border-width)  - var(--io-border-width));
      }
      :host .sizeButton {
        position: fixed;
        top: 0;
        right: 0;
        margin: var(--io-border-width);
        height: calc(var(--io-item-height) - var(--io-border-width)  - var(--io-border-width));
      }
      :host io-icon g {
        fill: var(--io-color);
      }
    `;
  }

  @Property('main')
  declare role: string;

  @Property('main')
  declare class: string;

  @Property(true)
  declare cache: boolean;

  @Property(true)
  declare horizontal: boolean;

  @Property({value: NAVIGATION_OPTIONS})
  declare options: Options;

  @Property(NAVIGATION_OPTIONS.path.bind('root'))
  declare selected: string;

  @Property($GUID)
  declare guid: string;

  @Property({value: [
    ['io-md-view', {name: 'about', path: './README.md'}],
    ['div', {name: 'catalog', class: 'catalog'}, [
      ['div', {class: 'settings'}, [
        ['io-option-menu', {options: TYPE_OPTIONS, value: $TYPE.value}],
        ['io-string', {class: 'filterInput', value: $FILTER, live: true}],
        ['div', [
          ['io-button', {class: 'filterButton', label: '▾'}],
          ['io-context-menu', {options: FILTER_OPTIONS, value: $FILTER.value, position: 'bottom'}],
        ]],
        ['div', {class: 'sizeButton'}, [
          ['io-icon', {icon: 'poly:grid'}],
          ['io-context-menu', {options: SIZE_OPTIONS, value: $SIZE.value, position: 'bottom'}],
        ]]
      ]],
      ['poly-gallery'],
    ]],
    ['poly-model-view', {name: 'model'}],
    ['poly-artist-list', {name: 'artists'}],
  ]})
  declare elements: string;

  static get Listeners(): any {
    return {
      'thumbnail-clicked': 'onThumbnailClicked',
      'filter-clicked': 'onFilterClicked'
    };
  }
  async selectedChanged() {
    super.selectedChanged();
    const ref = (document.referrer && document.referrer !== 'https://polygone.art/') ? `?ref=${document.referrer}` : '';
    await fetch(`${BLOB_URL}/page/${this.selected}${ref}`);

    if (this.selected !== 'model') {
      this.guid = '';
    }

    if (this.selected !== 'catalog') {
      $TYPE.value = 'all';
      $FILTER.value = '';
    }

    if (this.selected === 'model') {
      this.options[1]._properties.get('selected').value = false;
      this.options[1].changed();
    }
  }
  onThumbnailClicked(event: CustomEvent) {
    this.guid = event.detail;
    $PAGE.value = 'model';
  }
  onFilterClicked(event: CustomEvent) {
    // TODO: set all hashes at once
    $TYPE.value = 'all';
    $PAGE.value = 'catalog';
    $FILTER.value = event.detail;
  }
}