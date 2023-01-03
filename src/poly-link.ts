import { IoElement, RegisterIoElement, Property } from 'io-gui';

@RegisterIoElement
export class PolyLink extends IoElement {
  static get Style() {
    return /* css */`
      :host {
        color: var(--iotColorLink);
        height: var(--iotLineHeight);
        line-height: var(--iotLineHeight);
        cursor: pointer;
      }
      :host:hover {
        text-decoration: underline;
      }
    `;
  }

  @Property('')
  declare value: string;

  static get Listeners() {
    return {
      'click': 'onClicked'
    };
  }

  onClicked() {
    if (this.value.search('://') !== -1) {
      const link = document.createElement('a');
      link.href = this.value;
      link.download = this.value.split('/').pop() as string;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      this.dispatchEvent('poly-link-clicked', this.value, true);
    }
  }
}