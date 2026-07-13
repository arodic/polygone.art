var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { div, Property, ReactiveElement, Register } from '@io-gui/core';
import { ioDrawerHandle } from '@io-gui/layout';
function parseDrawerSizePx(size, containerHeight) {
    const pxMatch = size.match(/^([\d.]+)px$/);
    if (pxMatch)
        return parseFloat(pxMatch[1]);
    const pctMatch = size.match(/^([\d.]+)%$/);
    if (pctMatch)
        return containerHeight * parseFloat(pctMatch[1]) / 100;
    return 330;
}
let BottomDrawerSplit = class BottomDrawerSplit extends ReactiveElement {
    static get Style() {
        return /* css */ `
      :host {
        --io_drawerHandleSize: calc(var(--io_lineHeight) + var(--io_borderWidth) * 2);
        position: relative;
        display: block;
        overflow: hidden;
        height: 100%;
        width: 100%;
      }

      :host > .main {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      :host > .veil {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
      }
      :host[expanded] > .veil {
        pointer-events: auto;
      }

      :host > .drawer {
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2;
        display: flex;
        flex-direction: column;
      }

      :host > .drawer > .drawer-content {
        pointer-events: auto;
        display: flex;
        flex-direction: column;
      }
      :host:not([intro]) > .drawer > .drawer-content {
        transition: transform 0.25s ease-out;
      }
      :host:not([expanded]):not([intro]) > .drawer > .drawer-content {
        transform: translateY(calc(100% - var(--io_drawerHandleSize) - var(--io_revealOffset)));
      }
      :host[expanded] > .drawer > .drawer-content,
      :host[intro] > .drawer > .drawer-content {
        transform: translateY(0);
      }

      :host > .drawer > .drawer-content > .drawer-panel {
        flex: 0 0 var(--io_drawerSize);
        overflow: auto;
      }
      :host:not([expanded]):not([intro]) > .drawer > .drawer-content > .drawer-panel {
        overflow: hidden;
      }
    `;
    }
    #revealObserver;
    #introPlayed = false;
    #introTimeout;
    static get Listeners() {
        return {
            'io-drawer-toggle': 'onToggleExpanded',
        };
    }
    connectedCallback() {
        super.connectedCallback();
        if (this.#introPlayed) {
            this.intro = false;
            this.expanded = false;
            return;
        }
        this.#introPlayed = true;
        this.intro = true;
        this.expanded = true;
        this.#introTimeout = window.setTimeout(() => {
            this.#introTimeout = undefined;
            this.intro = false;
            this.expanded = false;
        }, 200);
    }
    onResized() {
        this.updateDrawerSize();
        this.updateRevealOffset();
    }
    updateDrawerSize() {
        const height = this.getBoundingClientRect().height;
        const size = parseDrawerSizePx(this.model.drawerSize, height);
        this.style.setProperty('--io_drawerSize', `${size}px`);
    }
    updateRevealOffset() {
        let offset = 0;
        if (this.revealSelector) {
            const target = this.querySelector(`.drawer-panel ${this.revealSelector}`);
            if (target) {
                offset = target.getBoundingClientRect().height;
            }
        }
        this.style.setProperty('--io_revealOffset', `${offset}px`);
    }
    observeRevealTarget() {
        if (!this.revealSelector)
            return;
        const panel = this.querySelector('.drawer-panel');
        if (!panel)
            return;
        this.#revealObserver?.disconnect();
        this.#revealObserver = new ResizeObserver(() => this.updateRevealOffset());
        this.#revealObserver.observe(panel);
        this.updateRevealOffset();
    }
    revealSelectorChanged() {
        this.observeRevealTarget();
    }
    onToggleExpanded(event) {
        event.preventDefault();
        event.stopPropagation();
        this.expanded = !this.expanded;
    }
    onVeilClick(event) {
        event.preventDefault();
        event.stopPropagation();
        this.expanded = false;
    }
    expandedChanged() {
        const handle = this.$['handle'];
        if (handle) {
            handle.expanded = this.expanded;
        }
    }
    modelMutated() {
        this.mutated();
    }
    mutated() {
        this.updateDrawerSize();
        const [main, drawer] = this.elements;
        this.render([
            div({ class: 'main' }, main ? [main] : []),
            div({ class: 'veil', '@click': this.onVeilClick }),
            div({ class: 'drawer' }, [
                div({ class: 'drawer-content' }, [
                    ioDrawerHandle({
                        id: 'handle',
                        orientation: 'vertical',
                        direction: 'trailing',
                        expanded: this.expanded,
                    }),
                    div({ class: 'drawer-panel' }, drawer ? [drawer] : []),
                ]),
            ]),
        ]);
        this.debounce(this.observeRevealTargetDebounced);
    }
    observeRevealTargetDebounced() {
        this.observeRevealTarget();
    }
    disconnectedCallback() {
        if (this.#introTimeout !== undefined) {
            window.clearTimeout(this.#introTimeout);
            this.#introTimeout = undefined;
        }
        this.#revealObserver?.disconnect();
        this.#revealObserver = undefined;
        super.disconnectedCallback();
    }
};
__decorate([
    Property({ type: Object })
], BottomDrawerSplit.prototype, "model", void 0);
__decorate([
    Property(Array)
], BottomDrawerSplit.prototype, "elements", void 0);
__decorate([
    Property({ type: Boolean, value: false, reflect: true })
], BottomDrawerSplit.prototype, "expanded", void 0);
__decorate([
    Property({ type: Boolean, value: false, reflect: true })
], BottomDrawerSplit.prototype, "intro", void 0);
__decorate([
    Property({ type: String, value: '' })
], BottomDrawerSplit.prototype, "revealSelector", void 0);
BottomDrawerSplit = __decorate([
    Register
], BottomDrawerSplit);
export { BottomDrawerSplit };
export const bottomDrawerSplit = function (props) {
    return BottomDrawerSplit.vConstructor(props);
};
