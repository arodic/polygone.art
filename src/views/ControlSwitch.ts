import { Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { ioIcon } from '@io-gui/icons'
import { ioSwitch } from '@io-gui/inputs'
import type { ControlMode } from '../tools/ModelViewerCameraTool.js'

export type { ControlMode }

type ControlSwitchProps = ReactiveElementProps & {
  value?: WithBinding<ControlMode>
}

@Register
export class ControlSwitch extends ReactiveElement {
  static override get Style() {
    return /* css */`
      :host {
        display: flex;
        align-items: center;
        gap: var(--io_spacing2);
        padding: var(--io_spacing) var(--io_spacing4);
        border-radius: var(--io_borderRadius);
        background-color: color-mix(in srgb, var(--io_bgColorStrong) 50%, transparent);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: var(--io_color);
        font-size: calc(0.86 * var(--io_fontSize));
        pointer-events: auto;
        border-radius: var(--io_fontSize);
      }
      :host > io-icon {
        opacity: 0.5;
      }
      :host > io-icon.active {
        opacity: 1;
      }
    `
  }

  static override get Listeners() {
    return {
      'io-boolean-clicked': 'onSwitchClicked',
    }
  }

  @Property({ value: 'FPS', type: String })
  declare value: ControlMode

  ready() {
    this.mutated()
  }

  override mutated() {
    this.render([
      ioIcon({ class: this.value === 'FPS' ? 'active' : '', value: 'poly:joystick', title: 'FPS' }),
      ioSwitch({ value: this.value === 'orbit' }),
      ioIcon({ class: this.value === 'orbit' ? 'active' : '', value: 'poly:orbit', title: 'Orbit' }),
    ])
  }

  onSwitchClicked(event: CustomEvent<{ value: boolean }>) {
    this.value = event.detail.value ? 'orbit' : 'FPS'
  }
}

export const controlSwitch = function(props: ControlSwitchProps = {}) {
  return ControlSwitch.vConstructor(props)
}
