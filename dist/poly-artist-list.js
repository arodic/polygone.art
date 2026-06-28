var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { div, Property, ReactiveElement, Register, ThemeSingleton } from '@io-gui/core';
import { polyLink } from './poly-link.js';
let PolyArtistList = class PolyArtistList extends ReactiveElement {
    static get Style() {
        return /* css */ `
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
        margin-top: var(--io_lineHeight);
      }
      @keyframes spinner {
      to {transform: rotate(360deg);}
    }
    :host[loading] {
      background-image: repeating-linear-gradient(135deg, var(--io_bgColorLight), var(--io_bgColor) 3px, var(--io_bgColor) 7px, var(--io_bgColorLight) 10px) !important;
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
      border: var(--io_border);
      border-top-color: var(--io_colorBlue);
      animation: spinner .6s linear infinite;
    }
    `;
    }
    artists = {};
    ids = [];
    static get Listeners() {
        return {
            scroll: 'onScroll',
        };
    }
    srcChanged() {
        this.artists = {};
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
                this.artists[data[0]] = {
                    name: data[1],
                    assets: []
                };
                for (let i = 2; i < data.length; i++) {
                    this.artists[data[0]].assets.push(data[i]);
                }
            }
            this.ids = Object.keys(this.artists).sort((a, b) => {
                if (this.artists[a].name?.toLowerCase() < this.artists[b].name?.toLowerCase())
                    return -1;
                if (this.artists[a].name?.toLowerCase() > this.artists[b].name?.toLowerCase())
                    return 1;
                return 0;
            });
            this.loading = false;
            this.mutated();
        })
            .catch(console.error);
    }
    onResized() {
        this.throttle(this.mutated);
    }
    onScroll() {
        this.throttle(this.mutated);
    }
    mutated() {
        const itemSize = this.querySelector('poly-link')?.clientHeight || ThemeSingleton.lineHeight;
        const firstIndex = Math.max(0, Math.floor(this.scrollTop / itemSize) - 2);
        const visibleListSize = Math.round(this.clientHeight / itemSize) + 4;
        const visibleList = this.ids.slice(firstIndex, firstIndex + visibleListSize);
        const top = firstIndex * itemSize;
        const height = this.ids.length * itemSize;
        this.style.setProperty('--polyArtistsHeight', `${height}px`);
        this.style.setProperty('--polyArtistsTop', `${top}px`);
        this.render([
            div({ class: 'height-padding' }),
            div({ class: 'top-padding' }),
            ...visibleList.map((item) => polyLink({ value: item, label: this.artists[item].name })),
        ]);
    }
};
__decorate([
    Property('')
], PolyArtistList.prototype, "src", void 0);
__decorate([
    Property({ value: false, reflect: true })
], PolyArtistList.prototype, "loading", void 0);
PolyArtistList = __decorate([
    Register
], PolyArtistList);
export { PolyArtistList };
export const polyArtistList = function (props) {
    return PolyArtistList.vConstructor(props);
};
