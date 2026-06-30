import { div, Property, ReactiveElement, ReactiveElementProps, Register } from '@io-gui/core'
import { BLOB_URL } from './constants.js'

type PolyThumbnailProps = ReactiveElementProps & {
  guid: string
  size: number
  thumbnails: Record<string, string>
}

const cachedId: string[] = []
const queue: PolyThumbnail[] = []

setInterval(() => {
  if (queue.length) {
    const i = Math.floor(Math.random() * queue.length)
    if (!queue[i]._disposed && queue[i].$.image) {
      queue[i].$.image.style.setProperty('background-image', `url("${BLOB_URL}/assets/${queue[i].guid}/thumbnail-${queue[i].size}.jpg")`)
      cachedId.push(queue[i].guid)
    }
    queue.splice(i, 1)
  }
}, 10)

@Register
export class PolyThumbnail extends ReactiveElement {
  static override get Style() {
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
    `
  }

  @Property('')
  declare guid: string

  @Property(256)
  declare size: number

  @Property({ type: Object, init: null })
  declare thumbnails: Record<string, string>

  static override get Listeners() {
    return {
      click: 'onClicked',
    }
  }

  onClicked() {
    this.dispatch('thumbnail-clicked', this.guid, true)
  }

  thumbnailsMutated() {
    this.mutated()
  }

  sizeChanged() {
    if (cachedId.indexOf(this.guid) !== -1) {
      cachedId.splice(cachedId.indexOf(this.guid), 1)
    }
  }

  override mutated() {
    this.render([div({ id: 'image' })])
    if (this.thumbnails?.[this.guid]) {
      this.style.setProperty('background-image', `url("data:image/jpeg;base64,${this.thumbnails[this.guid]}")`)
    } else {
      this.style.setProperty('background-image', '')
    }
    if (this.size === 32) {
      this.$.image?.style.setProperty('background-image', '')
    } else {
      if (cachedId.indexOf(this.guid) !== -1) {
        this.$.image?.style.setProperty('background-image', `url("${BLOB_URL}/assets/${this.guid}/thumbnail-${this.size}.jpg")`)
      } else {
        this.$.image?.style.setProperty('background-image', '')
        if (queue.indexOf(this) !== -1) queue.splice(queue.indexOf(this), 1)
        if (queue.indexOf(this) === -1) queue.push(this)
      }
    }
  }
}

export const polyThumbnail = function(props?: PolyThumbnailProps) {
  return PolyThumbnail.vConstructor(props)
}