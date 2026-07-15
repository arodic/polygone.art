import { Property, ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'

type PolyLinkProps = ReactiveElementProps & {
  value: string
  label: string
}

@Register
export class PolyLink extends ReactiveElement {
  static override get Style() {
    return /* css */`
      :host {
        color: var(--io_colorBlue);
        height: var(--io_lineHeight);
        line-height: var(--io_lineHeight);
        cursor: pointer;
      }
      :host:hover {
        text-decoration: underline;
      }
    `
  }

  @Property('')
  declare value: string

  @Property('')
  declare label: string

  static override get Listeners() {
    return {
      click: 'onClicked',
    }
  }

  constructor(props: PolyLinkProps) {
    super(props)
    this._flattenTextNode(this)
  }

  labelChanged() {
    this._flattenTextNode(this)
    this._textNode.nodeValue = String(this.label || '')
  }

  onClicked() {
    this.dispatch('poly-link-clicked', this.value, true)
  }
}

export const polyLink = function(props: PolyLinkProps) {
  return PolyLink.vConstructor(props)
}