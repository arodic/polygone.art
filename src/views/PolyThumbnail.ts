import { div, Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { BLOB_URL } from '../constants.js'

type PolyThumbnailProps = ReactiveElementProps & {
  guid: WithBinding<string>
  size: number
  thumbnail: string
}

/** Keys (`guid:size`) whose webp has been decoded and is safe to paint. */
const ready = new Set<string>()
const inflight = new Map<string, Promise<void>>()
const queue: PolyThumbnail[] = []
let drainTimer: ReturnType<typeof setInterval> | null = null

function thumbKey(guid: string, size: number) {
  return `${guid}:${size}`
}

function thumbUrl(guid: string, size: number) {
  return `${BLOB_URL}/assets/${guid}/thumbnail-${size}.webp`
}

function decodeThumb(guid: string, size: number): Promise<void> {
  const key = thumbKey(guid, size)
  if (ready.has(key)) return Promise.resolve()
  const pending = inflight.get(key)
  if (pending) return pending

  const img = new Image()
  img.decoding = 'async'
  img.src = thumbUrl(guid, size)
  const promise = img.decode()
    .then(() => { ready.add(key) })
    .catch(() => {})
    .finally(() => { inflight.delete(key) })
  inflight.set(key, promise)
  return promise
}

function enqueue(thumb: PolyThumbnail) {
  if (queue.includes(thumb)) return
  queue.push(thumb)
  if (drainTimer) return
  drainTimer = setInterval(() => {
    if (!queue.length) {
      clearInterval(drainTimer!)
      drainTimer = null
      return
    }
    const i = Math.floor(Math.random() * queue.length)
    const item = queue.splice(i, 1)[0]
    if (!item._disposed) void item.applyFullRes()
  }, 10)
}

function dequeue(thumb: PolyThumbnail) {
  const i = queue.indexOf(thumb)
  if (i !== -1) queue.splice(i, 1)
}

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

  @Property('')
  declare thumbnail: string

  /** Overlay key currently painted on `#image`, or '' if cleared. */
  // Plain field (not #private): base ctor may call mutated() before private fields init.
  _paintedKey = ''

  static override get Listeners() {
    return {
      click: 'onClicked',
    }
  }

  onClicked() {
    this.dispatch('thumbnail-clicked', this.guid, true)
  }

  override disconnectedCallback() {
    dequeue(this)
    super.disconnectedCallback()
  }

  /** Decode (if needed) then paint full-res, ignoring stale recycles. */
  async applyFullRes() {
    const { guid, size } = this
    if (!guid || size === 32) return
    const key = thumbKey(guid, size)
    await decodeThumb(guid, size)
    if (this._disposed || this.guid !== guid || this.size !== size) return
    if (!ready.has(key)) return
    this.$.image?.style.setProperty('background-image', `url("${thumbUrl(guid, size)}")`)
    this._paintedKey = key
  }

  override mutated() {
    this.render([div({ id: 'image' })])

    const key = this.size === 32 ? '' : thumbKey(this.guid, this.size)
    const isReady = key !== '' && ready.has(key)

    // Paint full-res before low-res so iOS never flashes the host JPEG underneath.
    if (isReady) {
      if (this._paintedKey !== key) {
        this.$.image?.style.setProperty('background-image', `url("${thumbUrl(this.guid, this.size)}")`)
        this._paintedKey = key
      }
    } else if (this._paintedKey !== key) {
      // Only clear when cell identity/size changed — not on every scroll mutate.
      this.$.image?.style.setProperty('background-image', '')
      this._paintedKey = ''
    }

    if (this.thumbnail) {
      this.style.setProperty('background-image', `url("data:image/jpeg;base64,${this.thumbnail}")`)
    } else {
      this.style.setProperty('background-image', '')
    }

    if (!key) return
    if (!isReady) enqueue(this)
  }
}

export const polyThumbnail = function(props?: PolyThumbnailProps) {
  return PolyThumbnail.vConstructor(props)
}
