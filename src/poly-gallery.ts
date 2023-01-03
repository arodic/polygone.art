/* eslint-disable @typescript-eslint/no-this-alias */
import { IoElement, RegisterIoElement, Property } from 'io-gui';
import './poly-thumbnail.js';

function nearestPowerOfTwo(size: number){
  return Math.pow(2, Math.ceil(Math.log(size)/Math.log(2)));
}

const sizes: Record<string, number> = {'32x32': 32, '64x64': 64, '128x128': 128, '256x256': 256, '512x512': 512};
const jpegHeaderData = '/9j/2wBDAAUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/2wBDAQUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/wgARCAAYACADASIAAhEBAxEB/';
const utf8decoder = new TextDecoder();

@RegisterIoElement
export class PolyGallery extends IoElement {
  static get Style() {
    return /* css */`
    :host {
      display: block;
      overflow-y: scroll;
      height: 100%;
      width: 100%;
      position: relative;
    }
    :host > .height-padding {
      display: block;
      width: 1px;
      height: var(--polyGalleryHeight);
      position: absolute;
    }
    :host > .top-padding {
      display: block;
      height: var(--polyGalleryTop);
    }

    :host > poly-thumbnail {
      border: 1px solid black;
      margin: 4px 0 0 4px;
      width: calc(var(--polyGalleryCellSize) - 4px);
      height: calc(var(--polyGalleryCellSize) - 4px);
      cursor: pointer;
    }
    :host > poly-thumbnail:hover {
      border-color: white;
      opacity: 0.75;
    }
    @keyframes spinner {
      to {transform: rotate(360deg);}
    }
    :host .io-loading {
      background-image: repeating-linear-gradient(135deg, var(--io-background-color-highlight), var(--io-background-color) 3px, var(--io-background-color) 7px, var(--io-background-color-highlight) 10px) !important;
      background-repeat: repeat;
      position: relative;
    }
    :host .io-loading:after {
      content: '';
      box-sizing: border-box;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      margin-top: -20px;
      margin-left: -20px;
      border-radius: 50%;
      border: var(--io-border);
      border-top-color: #000;
      animation: spinner .6s linear infinite;
    }
    `;
  }

  @Property('')
  declare size: string;

  @Property('')
  declare type: string;

  @Property('')
  declare filter: string;

  @Property('')
  declare assetsSrc: string;

  @Property('')
  declare thumbsSrc: string;

  @Property({type: Object, reactive: false})
  declare assets: Record<string, any>;

  @Property([])
  declare items: any[];

  @Property(Object)
  declare thumbnails: Record<string, any>;

  static get Listeners() {
    return {
      scroll: 'onScroll'
    };
  }

  thumbsSrcChanged() {
    fetch(this.thumbsSrc)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`);
      }
      const reader = response.body?.getReader();
      let textTail = '';
      const scope = this;
      new ReadableStream({
        start(controller) {
          function push() {
            return reader?.read().then(({done, value}) => {
              const valueStr = utf8decoder.decode(value);
              if (done) {
                controller.close();
                scope.dispatchEvent('object-mutated', {object: scope.thumbnails}, false, window);
                return;
              }
              const rows = (textTail + valueStr).split('\n');
              textTail = rows[rows.length - 1];
              rows.length = rows.length - 1;
              for (let i = 0; i < rows.length; i++) {
                const data = rows[i].split(',');
                scope.thumbnails[data[0]] = jpegHeaderData + data[1];
              }
              if (!scope.thumbnailLoaderTimeout) scope.thumbnailLoaderTimeout = setTimeout(() => {
                scope.dispatchEvent('object-mutated', {object: scope.thumbnails}, false, window);
                scope.thumbnailLoaderTimeout = null;
              }, 1000);
              void push();
            });
          }
          void push();
        }
      });
    })
    .catch(console.error);
  }
  assetsSrcChanged() {
    fetch(this.assetsSrc)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`);
      }
      const reader = response.body?.getReader();
      let textTail = '';
      const scope = this;
      new ReadableStream({
        start(controller) {
          function push() {
            return reader?.read().then(({ done, value }) => {
              const valueStr = utf8decoder.decode(value);
              if (done) {
                controller.close();
                scope.applyFilter();
                return;
              }
              const rows = (textTail + valueStr).split('\n');
              textTail = rows[rows.length - 1];
              rows.length = rows.length - 1;
              for (let i = 0; i < rows.length; i++) {
                const data = rows[i].split(',');
                scope.assets[data[0]] = {
                  authorId: data[1],
                  name: data[2] || '',
                  tags: []
                };
                for (let i = 3; i < data.length; i++) {
                  scope.assets[data[0]].tags.push(data[i]);
                }
              }
              if (!scope.assetLoaderTimeout) scope.assetLoaderTimeout = setTimeout(() => {
                scope.applyFilter();
                scope.assetLoaderTimeout = null;
                scope.classList.toggle('io-loading', false);
              }, 100);
              void push();
            });
          }
          void push();
        }
      });
    })
    .catch(console.error);
  }
  onResized() {
    this.throttle(this.changed);
  }
  onScroll() {
    this.throttle(this.changed);
  }
  typeChanged() {
    this.applyFilter();
  }
  filterChanged() {
    this.applyFilter();
  }
  applyFilter() {
    const filtered = [];
    const indexOf = (item: any, filter: any) => {
      if (item instanceof Array) return item.findIndex(item => filter.toLowerCase() === item.toLowerCase());
      return item.toLowerCase().indexOf(filter.toLowerCase());
    };
    for (const id in this.assets) {
      if (this.type === 'All Models') {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter) {
          filtered.push(id);
        }
      } else if (this.type === 'Tilt Brush' && this.assets[id].tags.indexOf('tilt') !== -1) {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter
          ) {
          filtered.push(id);
        }
      } else if (this.type === '3D Mesh' && this.assets[id].tags.indexOf('tilt') === -1) {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter
          ) {
          filtered.push(id);
        }
      }
    }
    this.items = filtered;
  }
  changed = () => {
    const size = sizes[this.size];
    const powTwoSize = Math.max(32, Math.min(512, nearestPowerOfTwo(size)));
    const columnCount = Math.ceil(this.clientWidth / size);

    const itemSize = (this.clientWidth) / columnCount;
    const firstIndex = Math.floor(this.scrollTop / itemSize);

    const visibleListSize = Math.round(this.clientHeight / itemSize) * columnCount + 4 * columnCount;
    const visibleList = this.items.slice(
      firstIndex * columnCount,
      firstIndex * columnCount + visibleListSize
    );

    const top = firstIndex * itemSize;
    const height = this.items.length * itemSize / columnCount;

    this.style.setProperty('--polyGalleryCellSize', `${itemSize}px`);
    this.style.setProperty('--polyGalleryHeight', `${height}px`);
    this.style.setProperty('--polyGalleryTop', `${top}px`);

    this.template([
      ['div', {className: 'height-padding'}],
      ['div', {className: 'top-padding'}],
      ...visibleList.map((item: string) => ['poly-thumbnail', {
        guid: item,
        thumbnails: this.thumbnails,
        size: powTwoSize
      }]),
    ]);
  };
}