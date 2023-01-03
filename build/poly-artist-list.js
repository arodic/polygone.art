var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { IoElement, RegisterIoElement, Property, IoThemeSingleton } from 'io-gui';
import './poly-link.js';
let PolyArtistList = class PolyArtistList extends IoElement {
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
        margin-top: var(--iotLineHeight);
      }
      :host > .bottom-padding {
        display: block;
        height: var(--iotLineHeight);
      }
    `;
    }
    static get Listeners() {
        return {
            scroll: 'onScroll'
        };
    }
    srcChanged() {
        this.users = {};
        this.ids = [];
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
                if (this.users[a].name?.toLowerCase() < this.users[b].name?.toLowerCase()) {
                    return -1;
                }
                if (this.users[a].name?.toLowerCase() > this.users[b].name?.toLowerCase()) {
                    return 1;
                }
                return 0;
            });
            this.changed();
        })
            .catch(console.error);
    }
    connectedCallback() {
        super.connectedCallback();
        this.updateVirualList();
    }
    onResized() {
        this.updateVirualList();
    }
    onScroll() {
        this.updateVirualList();
    }
    updateVirualList() {
        if (!this.scrollTick)
            this.scrollTick = window.requestAnimationFrame(() => {
                delete this.scrollTick;
                this.changed();
            });
    }
    changed() {
        const itemSize = this.querySelector('poly-link')?.clientHeight || IoThemeSingleton.iotLineHeight;
        const firstIndex = Math.max(0, Math.floor(this.scrollTop / itemSize) - 2);
        const visibleListSize = Math.round(this.clientHeight / itemSize) + 4;
        const visibleList = this.ids.slice(firstIndex, firstIndex + visibleListSize);
        const top = firstIndex * itemSize;
        const height = this.ids.length * itemSize;
        this.style.setProperty('--polyArtistsHeight', `${height}px`);
        this.style.setProperty('--polyArtistsTop', `${top}px`);
        this.template([
            ['div', { className: 'height-padding' }],
            ['div', { className: 'top-padding' }],
            ...visibleList.map((item) => ['poly-link', { value: item }, this.users[item].name]),
            ['div', { className: 'bottom-padding' }],
        ]);
    }
};
__decorate([
    Property('')
], PolyArtistList.prototype, "src", void 0);
__decorate([
    Property({ type: Object, reactive: false })
], PolyArtistList.prototype, "users", void 0);
__decorate([
    Property({ type: Array, reactive: false })
], PolyArtistList.prototype, "ids", void 0);
PolyArtistList = __decorate([
    RegisterIoElement
], PolyArtistList);
export { PolyArtistList };
//# sourceMappingURL=poly-artist-list.js.map