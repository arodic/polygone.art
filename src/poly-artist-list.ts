import { IoElement, RegisterIoElement, Property, IoThemeSingleton } from 'io-gui';
import './poly-link.js';

type User = {
  name: string;
  assets: string[];
};

@RegisterIoElement
export class PolyArtistList extends IoElement {
  static get Style() {
    return /* css */`
      :host {
        display: block;
        position: relative;
        overflow-y: scroll;
        height: 100%;
        width: 100%;
        padding: 0 3em;
      }
      :host > .height-padding {
        display: block;
        position: absolute;
        width: 1px;
        height: var(--polyArtistsHeight);
      }
      :host > .top-padding {
        display: block;
        height: var(--polyArtistsTop);
        margin-top: var(--iotLineHeight);
      }
      @keyframes spinner {
      to {transform: rotate(360deg);}
    }
    :host[loading] {
      background-image: repeating-linear-gradient(135deg, var(--io-background-color-highlight), var(--io-background-color) 3px, var(--io-background-color) 7px, var(--io-background-color-highlight) 10px) !important;
      background-repeat: repeat;
      position: relative;
    }
    :host[loading]:after {
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
      border: var(--iotBorder);
      border-top-color: var(--iotColorSelected);
      animation: spinner .6s linear infinite;
    }
    `;
  }

  @Property('')
  declare src: string;

  @Property({value: false, reflect: true})
  declare loading: boolean;

  @Property({type: Object, reactive: false})
  declare users: Record<string, User>;

  @Property({type: Array, reactive: false})
  declare ids: string[];

  static get Listeners() {
    return {
      scroll: 'onScroll'
    };
  }

  srcChanged() {
    this.users = {};
    this.ids = [];
    this.loading = true;
    fetch(this.src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
    .then((data) => {
      const rows = data.split('\n');
      rows.length = rows.length - 1;
      for (let i = 0; i < rows.length; i++) {
        const data = rows[i].split(',');
        this.users[data[0]] = {
          name: data[1],
          assets: []
        };
        for (let i = 2; i < data.length; i++) {
          this.users[data[0]].assets.push(data[i]);
        }
      }
      this.ids = Object.keys(this.users).sort((a, b) => {
        if(this.users[a].name?.toLowerCase() < this.users[b].name?.toLowerCase()) { return -1; }
        if(this.users[a].name?.toLowerCase() > this.users[b].name?.toLowerCase()) { return 1; }
        return 0;
      });
      this.loading = false;
      this.changed();
    })
    .catch(console.error);
  }
  onResized() {
    this.throttle(this.changed);
  }
  onScroll() {
    this.throttle(this.changed);
  }
  changed = () => {
    const itemSize = this.querySelector('poly-link')?.clientHeight || IoThemeSingleton.iotLineHeight;
    const firstIndex = Math.max(0, Math.floor(this.scrollTop / itemSize) - 2);

    const visibleListSize = Math.round(this.clientHeight / itemSize) + 4;
    const visibleList = this.ids.slice(firstIndex, firstIndex + visibleListSize);

    const top = firstIndex * itemSize;
    const height = this.ids.length * itemSize;

    this.style.setProperty('--polyArtistsHeight', `${height}px`);
    this.style.setProperty('--polyArtistsTop', `${top}px`);

    this.template([
      ['div', {className: 'height-padding'}],
      ['div', {className: 'top-padding'}],
      ...visibleList.map((item: string) => ['poly-link', {value: item}, this.users[item].name]),
    ]);
  };
}