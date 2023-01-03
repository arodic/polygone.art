/* eslint-disable @typescript-eslint/no-floating-promises */
import { IoElement, RegisterIoElement, Property } from 'io-gui';
import {BLOB_URL} from './poly-app.js';

type AssetInfo = Record<string, any>;
const chachedAssets: Record<string, AssetInfo> = {};

@RegisterIoElement
export class PolyModelView extends IoElement {
  static get Style() {
    return /* css */`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      padding: var(--io-spacing);
      line-height: 1.4em;
      max-width: 512px;
    }
    :host model-viewer {
      width: 100%;
      height: var(--viewer-height);
    }
    :host .info {
      background: var(--io-background-color-dark);
      padding: var(--io-spacing);
      margin: 0;
    }
    :host .description {
      padding: var(--io-spacing) 0;
    }
    :host .license {
      border-top: var(--io-border);
      border-bottom: var(--io-border);
      padding: var(--io-spacing) 0;
      margin-bottom: var(--io-spacing);
    }
    :host .info :last-child {
      float: right;
      opacity: 0.5;
    }
    :host h4 {
      margin: 0;
    }
    :host .downloads,
    :host .tags {
      margin: 0;
      padding: 0.5em;
    }
    :host .downloads > li,
    :host .tags > li {
      display: inline-block;
      margin-right: 0.5em;
    }
    `;
  }
  @Property('')
  declare guid: string;

  @Property({reactive: true})
  declare assetInfo: any;

  constructor() {
    super();
    this.guidChanged();
  }
  onResized() {
    const height = Math.min(this.clientWidth, 512) / 1.333;
    this.style.setProperty('--viewer-height', `${height}px`);
  }
  guidChanged() {
    if (chachedAssets[this.guid]) {
      this.assetInfo = chachedAssets[this.guid];
      this.changed();
    } else if (this.guid) {
      fetch(`./assets/${this.guid}/data.json`).then(async response => {
        this.assetInfo = await response.json();
        chachedAssets[this.guid] = this.assetInfo;
        this.changed();
      });
    }
    fetch(`${BLOB_URL}/guid/${this.guid}`);
  }
  assetInfoChanged() {
    this.assetInfo = this.assetInfo || {
      tags: [],
      formats: [],
    };

    const gltf2model = this.assetInfo.formats.find((format: any) => format.formatType === 'GLTF2');
    const fltf2Root = gltf2model?.root?.relativePath;

    this.template([
      ['model-viewer', {
        id: 'reveal',
        poster: `./assets/${this.guid}/thumbnail-512.jpg`,
        alt: this.assetInfo?.description || this.assetInfo?.name,
        'environmentImage': 'neutral',
        'autoRotate': true,
        'cameraControls': true,
        // reveal: 'interaction',
        // 'on-progress': (event) => { console.log(event) },
        // 'on-error': (event) => { console.log(event) },
        // 'on-preload': (event) => { console.log(event) },
        // 'on-load': (event) => { console.log(event) },
        // 'on-model-visibility': (event) => { console.log(event) },
        src: fltf2Root ? `${BLOB_URL}/assets/${this.guid}/GLTF2/${fltf2Root}` : '',
        style: {
          'background-color': this.assetInfo?.presentationParams?.backgroundColor || '#000000'
        }
      }, []],
      ['div', {class: 'info'}, [
        ['span', `${this.assetInfo.name} by `],
        ['poly-link', {value: this.assetInfo.authorId}, this.assetInfo.authorName],
        ['span', new Date(this.assetInfo.createTime).toDateString()],
      ]],
      this.assetInfo.description ? ['div', {class: 'description'}, `${this.assetInfo.description}`] : [],
      ['div', {class: 'license'}, [
        ['span', 'This content is published under a CC-BY license. You\'re free to use this as long as you credit the author.']
      ]],
      this.assetInfo.tags.length ? ['h4', 'Tags:'] : [],
      ['ul', {class: 'tags'}, this.assetInfo.tags.map((tag: string) => ['li', [['poly-link', {value: tag}, `#${tag}`]]])],
      ['h4', 'Downloads:'],
      ['ul', {class: 'downloads'}, this.assetInfo.formats.map((format: any) => ['li', [
        ['poly-link', {value: `${BLOB_URL}/archives/${this.guid}/${this.guid}_${format.formatType}.zip`}, `${format.formatType} ⇩`]
      ]])],
    ]);
  }
}