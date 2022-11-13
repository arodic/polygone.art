import {IoElement, RegisterIoElement} from "./iogui.js";
import "./poly-thumbnail.js";
import {$TYPE, $SIZE, $FILTER, BLOB_URL} from './poly-env.js';

function nearestPowerOfTwo(size){
  return Math.pow(2, Math.ceil(Math.log(size)/Math.log(2))); 
}

export class PolyGallery extends IoElement {
  static get Style() {
    return /* css */`
    :host {
      overflow-y: scroll;
      height: 100%;
      width: 100%;
      position: relative;
    }
    :host > .height-padding {
      display: block;
      width: 1px;
      height: var(--vs-height);
      position: absolute;
    }
    :host > .top-padding {
      display: block;
      height: var(--vs-top-height);
    }
    :host > .bottom-padding {
      display: block;
      height: var(--vs-bottom-height);
    }

    :host > poly-thumbnail {
      border: 1px solid black;
      margin: 4px 0 0 4px;
      width: calc(var(--vs-size) - 4px);
      height: calc(var(--vs-size) - 4px);
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
  static get Properties() {
    return {
      role: 'document',
      size: $SIZE,
      type: $TYPE,
      filter: $FILTER,
      computedSize: 256,
      currentBase: Number,
      assets: {type: Object, notify: false},
      items: Array,
      thumbnails: Object,
    };
  }
  static get Listeners() {
    return {
      scroll: 'onScroll'
    }
  }
  constructor() {
    super();

    this.currentBase = this.currentBase === undefined ? 0 : this.currentBase;
    const jpegHeaderData = '/9j/2wBDAAUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/2wBDAQUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/wgARCAAYACADASIAAhEBAxEB/';
    let utf8decoder = new TextDecoder();
    // TODO: clean up
    fetch('./data/thumbs.csv').then(async response => {
      const reader = response.body.getReader();
      let textTail = "";
      const scope = this;
      new ReadableStream({
        start(controller) {
          function push() {
            return reader.read().then(({ done, value }) => {
              value = utf8decoder.decode(value);
              if (done) {
                controller.close();
                scope.dispatchEvent('object-mutated', {object: scope.thumbnails}, false, window);
                return;
              }
              let rows = (textTail + value).split('\n');
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
              push();
            });
          };
          push();
        }
      })
    });
    this.classList.toggle('io-loading', true);
    fetch('./data/assets.csv').then(async response => {
      const reader = response.body.getReader();
      let textTail = "";
      const scope = this;
      new ReadableStream({
        start(controller) {
          function push() {
            return reader.read().then(({ done, value }) => {
              value = utf8decoder.decode(value);
              if (done) {
                controller.close();
                scope.applyFilter();
                return;
              }
              let rows = (textTail + value).split('\n');
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
              push();
            });
          };
          push();
        }
      })
    });
  }
  connectedCallback() {
    super.connectedCallback();
    this.calcSize();
    this.onScroll();
  }
  onResized() {
    this.calcSize();
    this.onScroll();
  }
  calcSize() {
    let size = 128;
    switch (this.size) {
      case '32x32':
        size = 32;
        break;
      case '64x64':
        size = 64;
        break;
      case '128x128':
        size = 128;
        break;
      case '256x256':
        size = 256;
        break;
      case '512x512':
        size = 512;
        break;
    }
    this.powTwoSize = Math.max(32, Math.min(512, nearestPowerOfTwo(size)));
    this.wrapperHeight = this.clientHeight;
    this.wrapperWidth = this.clientWidth;
    this.columnCount = Math.ceil(this.wrapperWidth / size);
    this.computedSize = (this.wrapperWidth) / this.columnCount;
  }
  onScroll() {
    if (this.scrollTicking) {
      window.cancelAnimationFrame(this.scrollTicking);
    }
    this.scrollTicking = window.requestAnimationFrame(() => {
      this.currentBase = Math.floor(this.scrollTop / this.computedSize);
    });
  }
  sizeChanged() {
    this.calcSize();
    this.onScroll();
  }
  typeChanged() {
    this.applyFilter();
  }
  filterChanged() {
    this.applyFilter();
    fetch(`${BLOB_URL}/filter/${this.filter}`);
  }
  applyFilter() {
    const filtered = [];
    const indexOf = (item, filter) => {
      if (item instanceof Array) return item.findIndex(item => filter.toLowerCase() === item.toLowerCase());
      return item.toLowerCase().indexOf(filter.toLowerCase());
    }
    for (let id in this.assets) {
      if (this.type === 'all') {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter) {
          filtered.push(id);
        }
      } else if (this.type === 'tilt' && this.assets[id].tags.indexOf('tilt') !== -1) {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter
          ) {
          filtered.push(id);
        }
      } else if (this.type === '!tilt' && this.assets[id].tags.indexOf('tilt') === -1) {
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
  changed() {
    const listSize = Math.round(this.wrapperHeight / this.computedSize) * this.columnCount + 4 * this.columnCount;

    const filteredList = this.items.slice(
      this.currentBase * this.columnCount,
      this.currentBase * this.columnCount + listSize
    );

    const top = this.currentBase * this.computedSize;
    const height = this.items.length * this.computedSize / this.columnCount;

    this.style.setProperty('--vs-size', `${this.computedSize}px`);
    this.style.setProperty('--vs-height', `${height}px`);
    this.style.setProperty('--vs-top-height', `${top}px`);

    const elements = [];
    for (let i = 0; i < filteredList.length; i++) {
      elements.push(['poly-thumbnail', {
        guid: filteredList[i],
        thumbnails: this.thumbnails,
        size: this.powTwoSize
      }])
    }
    this.template([
      ['div', {className: 'height-padding'}],
      ['div', {className: 'top-padding'}],
      ...elements,
      ['div', {className: 'bottom-padding'}],
    ]);
  }
}

RegisterIoElement(PolyGallery);