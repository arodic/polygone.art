import {IoElement, RegisterIoElement} from "./iogui.js";

const cachedId = [];
const queue = [];

setInterval(() => {
  if (queue.length) {
    const i = Math.floor(Math.random() * queue.length);
    queue[i].$.image.style.setProperty('background-image', `url("./assets/${queue[i].guid}/thumbnail-${queue[i].size}.jpg")`);
    cachedId.push(queue[i].guid);
    queue.splice(i, 1);
  }
}, 1);

export class PolyThumbnail extends IoElement {
  static get Style() {
    return /* css */`
    :host {
      border: 1px solid black;
      box-sizing: border-box;
      display: inline-block;
      float: left;
      color: rgba(0, 0, 0, 0.1);
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
    }
    :host div {
      white-space: nowrap;
      width: 100%;
      height: 100%;
      background-position: center;
      background-repeat: no-repeat;
      background-size: cover;
    }
    `;
  }
  static get Properties() {
    return {
      guid: {
        type: String,
      },
      size: 256,
      thumbnails: {type: Object, observe: true},
    };
  }
  static get Listeners() {
    return {
      'click': 'onClicked'
    }
  }
  onClicked() {
    this.dispatchEvent('thumbnail-clicked', this.guid, true);
  }
  sizeChanged() {
    if (cachedId.indexOf(this.guid) !== -1) {
      cachedId.splice(cachedId.indexOf(this.guid), 1);
    }
  }
  changed() {
    if (this.thumbnails[this.guid]) {
      this.style.setProperty('background-image', `url("data:image/jpeg;base64,${this.thumbnails[this.guid]}")`);
    } else {
      this.style.setProperty('background-image', '');
    }
    if (this.size === 32) {
      this.$.image && this.$.image.style.setProperty('background-image', '');
    } else {
      if (cachedId.indexOf(this.guid) !== -1) {
        this.$.image && this.$.image.style.setProperty('background-image', `url("./assets/${this.guid}/thumbnail-${this.size}.jpg")`);
      } else {
        this.$.image && this.$.image.style.setProperty('background-image', '');
        if (queue.indexOf(this) !== -1) queue.splice(queue.indexOf(this), 1);
        if (queue.indexOf(this) === -1) queue.push(this);
      }
    }
    this.template([
      ['div', {id: 'image'}]
    ])
  }
}

RegisterIoElement(PolyThumbnail);