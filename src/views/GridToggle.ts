import { Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { ioIcon } from '@io-gui/icons'
import { ioSwitch } from '@io-gui/inputs'

type GridToggleProps = ReactiveElementProps & {
  value?: WithBinding<boolean>
}

@Register
export class GridToggle extends ReactiveElement {
  static override get Style() {
    return /* css */`
      :host {
        display: flex;
        align-items: center;
        gap: var(--io_spacing2);
        padding: var(--io_spacing) var(--io_spacing4);
        border-radius: var(--io_fontSize);
        background-color: color-mix(in srgb, var(--io_bgColorStrong) 50%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: var(--io_color);
        font-size: calc(0.86 * var(--io_fontSize));
        pointer-events: auto;
      }
      :host > io-icon {
        opacity: 0.5;
      }
      :host[value] > io-icon {
        opacity: 1;
      }
    `
  }

  @Property({ value: true, type: Boolean, reflect: true })
  declare value: boolean

  ready() {
    this.mutated()
  }

  override mutated() {
    this.render([
      ioIcon({ value: 'poly:grid', title: 'Grid' }),
      ioSwitch({ value: this.bind('value') }),
    ])
  }
}

export const gridToggle = function(props: GridToggleProps = {}) {
  return GridToggle.vConstructor(props)
}
