import {IoElement, IoStorageFactory as $} from "./iogui.js";
import "./poly-thumbnail.js";
import {$TYPE, $SIZE, $FILTER} from './poly-state.js';

function nearestPowerOfTwo(size){
  return Math.pow(2, Math.ceil(Math.log(size)/Math.log(2))); 
}

export class PolyArtistList extends IoElement {
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

    :host > poly-link {
      margin: 4px 0 0 4px;
      display: block;
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
      type: $TYPE,
      filter: $FILTER,
      computedSize: 256,
      currentBase: Number,
      users: {type: Object, notify: false},
      names: Array,
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
    let utf8decoder = new TextDecoder();
    this.classList.toggle('io-loading', true);
    fetch('./data/users.csv').then(async response => {
      const reader = response.body.getReader();
      let textStream = "";
      const scope = this;
      new ReadableStream({
        start(controller) {
          function push() {
            return reader.read().then(({ done, value }) => {
              value = utf8decoder.decode(value);
              if (done) {
                controller.close();
                scope.sortNames();
                return;
              }
              let rows = value.split('\n');
              textStream += rows[rows.length - 1];
              rows.length = rows.length - 1;
              for (let i = 0; i < rows.length; i++) {
                const data = rows[i].split(',');
                scope.users[data[0]] = {
                  name: data[1],
                  assets: []
                };
                for (let i = 2; i < data.length; i++) {
                  scope.users[data[0]].assets.push(data[i]);
                }
              }
              if (!scope.assetLoaderTimeout) scope.assetLoaderTimeout = setTimeout(() => {
                scope.sortNames();
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
    this.powTwoSize = Math.max(32, Math.min(512, nearestPowerOfTwo(size)));
    this.wrapperHeight = this.clientHeight;
    this.computedSize = 22;
  }
  onScroll() {
    if (this.scrollTicking) {
      window.cancelAnimationFrame(this.scrollTicking);
    }
    this.scrollTicking = window.requestAnimationFrame(() => {
      this.currentBase = Math.floor(this.scrollTop / this.computedSize);
    });
  }
  sortNames() {
    const keys = Object.keys(this.users);
    this.names = keys.sort((a, b) => {
      if(this.users[a].name?.toLowerCase() < this.users[b].name?.toLowerCase()) { return -1; }
      if(this.users[a].name?.toLowerCase() > this.users[b].name?.toLowerCase()) { return 1; }
      return 0;
    });
  }
  changed() {
    const listSize = Math.round(this.wrapperHeight / this.computedSize) + 20;

    const filteredList = this.names.slice(
      this.currentBase,
      this.currentBase + listSize
    );

    const top = this.currentBase * this.computedSize;
    const height = this.names.length * this.computedSize;

    this.style.setProperty('--vs-size', `${this.computedSize}px`);
    this.style.setProperty('--vs-height', `${height}px`);
    this.style.setProperty('--vs-top-height', `${top}px`);

    const elements = [];
    for (let i = 0; i < filteredList.length; i++) {
      elements.push(['poly-link', {value: filteredList[i]}, this.users[filteredList[i]].name]);
    }
    this.template([
      ['div', {className: 'height-padding'}],
      ['div', {className: 'top-padding'}],
      ...elements,
      ['div', {className: 'bottom-padding'}],
    ]);
  }
}

PolyArtistList.Register();