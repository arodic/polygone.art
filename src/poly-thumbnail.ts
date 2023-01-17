import { IoElement, RegisterIoElement, Property } from 'io-gui';

const cachedId: string[] = [];
const queue: Record<string, PolyThumbnail>[] = [];

setInterval(() => {
  if (queue.length) {
    const i = Math.floor(Math.random() * queue.length);
    if (!queue[i]._disposed) {
      queue[i].$.image.style.setProperty('background-image', `url("./assets/${queue[i].guid}/thumbnail-${queue[i].size}.jpg")`);
      cachedId.push((queue[i] as PolyThumbnail).guid);
    }
    queue.splice(i, 1);
  }
}, 1);

@RegisterIoElement
export class PolyThumbnail extends IoElement {
  static get Style() {
    return /* css */`
      :host {
        box-sizing: border-box;
        display: inline-block;
        float: left;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
      :host div {
        width: 100%;
        height: 100%;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
      }
    `;
  }

  @Property('')
  declare guid: string;

  @Property(256)
  declare size: number;

  @Property({type: Object, observe: true})
  declare thumbnails: Record<string, string>;

  static get Listeners() {
    return {
      'click': 'onClicked'
    };
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
    this.template([['div', {$: 'image'}]]);
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
  }
}