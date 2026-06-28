/* eslint-disable @typescript-eslint/no-this-alias */
import { div, Property, ReactiveElement, ReactiveElementProps, Register, WithBinding } from '@io-gui/core'
import { polyThumbnail } from './poly-thumbnail.js'

type PolyGalleryProps = ReactiveElementProps & {
  size: WithBinding<string>
  type: WithBinding<string>
  filter: WithBinding<string>
  assetsSrc: string
  thumbsSrc: string
}

function nearestPowerOfTwo(size: number){
  return Math.pow(2, Math.ceil(Math.log(size) / Math.log(2)))
}

const jpegHeaderData = '/9j/2wBDAAUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/2wBDAQUFBQUFBQUGBgUICAcICAsKCQkKCxEMDQwNDBEaEBMQEBMQGhcbFhUWGxcpIBwcICkvJyUnLzkzMzlHREddXX3/wgARCAAYACADASIAAhEBAxEB/'
const utf8decoder = new TextDecoder()

@Register
export class PolyGallery extends ReactiveElement {
  static override get Style() {
    return /* css */`
    :host {
      display: block;
      overflow-y: scroll;
      height: 100%;
      width: 100%;
      position: relative;

    }
    :host > .height-padding {
      display: block;
      width: 1px;
      height: var(--polyGalleryHeight);
      position: absolute;
    }
    :host > .top-padding {
      display: block;
      height: var(--polyGalleryTop);
    }

    :host > poly-thumbnail {
      width: calc(var(--polyGalleryCellSize) - 0px);
      height: calc(var(--polyGalleryCellSize) - 0px);
      cursor: pointer;
    }
    :host > poly-thumbnail:hover {
      border-color: white;
      opacity: 0.75;
    }
    @keyframes spinner {
      to {transform: rotate(360deg);}
    }
    :host .io-loading {
      background-image: repeating-linear-gradient(135deg, var(--io_bgColorLight), var(--io_bgColor) 3px, var(--io_bgColor) 7px, var(--io_bgColorLight) 10px) !important;
      background-repeat: repeat;
      position: relative;
    }
    :host .io-loading:after {
      content: '';
      box-sizing: border-box;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      margin-top: -20px;
      margin-left: -20px;
      border-radius: 50%;
      border: var(--io_border);
      border-top-color: #000;
      animation: spinner .6s linear infinite;
    }
    `
  }

  @Property('')
  declare size: string

  @Property('')
  declare type: string

  @Property('')
  declare filter: string

  @Property('')
  declare assetsSrc: string

  @Property('')
  declare thumbsSrc: string

  @Property({ type: Object, init: null })
  declare assets: Record<string, { authorId: string; name: string; tags: string[] }>

  @Property({ type: Array, init: null })
  declare items: string[]

  @Property({ type: Object, init: null })
  declare thumbnails: Record<string, string>

  assetLoaderTimeout: ReturnType<typeof setTimeout> | null = null
  thumbnailLoaderTimeout: ReturnType<typeof setTimeout> | null = null
  filterTimeout: ReturnType<typeof setTimeout> | null = null

  static override get Listeners() {
    return {
      scroll: 'onScroll',
    }
  }

  thumbsSrcChanged() {
    fetch(this.thumbsSrc)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`)
      }
      const reader = response.body?.getReader()
      let textTail = ''
      const scope = this
      new ReadableStream({
        start(controller) {
          function push() {
            return reader?.read().then(({done, value}) => {
              const valueStr = utf8decoder.decode(value)
              if (done) {
                controller.close()
                scope.dispatchMutation(scope.thumbnails)
                return
              }
              const rows = (textTail + valueStr).split('\n')
              textTail = rows[rows.length - 1]
              rows.length = rows.length - 1
              for (let i = 0; i < rows.length; i++) {
                const data = rows[i].split(',')
                scope.thumbnails[data[0]] = jpegHeaderData + data[1]
              }
              if (!scope.thumbnailLoaderTimeout) scope.thumbnailLoaderTimeout = setTimeout(() => {
                scope.dispatchMutation(scope.thumbnails)
                scope.thumbnailLoaderTimeout = null
              }, 1000)
              void push()
            })
          }
          void push()
        }
      })
    })
    .catch(console.error)
  }
  assetsSrcChanged() {
    fetch(this.assetsSrc)
    .then(async response => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`)
      }
      const reader = response.body?.getReader()
      let textTail = ''
      const scope = this
      new ReadableStream({
        start(controller) {
          function push() {
            return reader?.read().then(({ done, value }) => {
              const valueStr = utf8decoder.decode(value)
              if (done) {
                controller.close()
                scope._applyFilter()
                return
              }
              const rows = (textTail + valueStr).split('\n')
              textTail = rows[rows.length - 1]
              rows.length = rows.length - 1
              for (let i = 0; i < rows.length; i++) {
                const data = rows[i].split(',')
                scope.assets[data[0]] = {
                  authorId: data[1],
                  name: data[2] || '',
                  tags: []
                }
                for (let i = 3; i < data.length; i++) {
                  scope.assets[data[0]].tags.push(data[i])
                }
              }
              if (!scope.assetLoaderTimeout) scope.assetLoaderTimeout = setTimeout(() => {
                scope._applyFilter()
                scope.assetLoaderTimeout = null
                scope.classList.toggle('io-loading', false)
              }, 100)
              void push()
            })
          }
          void push()
        }
      })
    })
    .catch(console.error)
  }
  onResized() {
    this.throttle(this.mutated)
  }
  onScroll() {
    this.throttle(this.mutated)
  }
  typeChanged() {
    this._applyFilter()
  }
  filterChanged() {
    if (this.filterTimeout) clearTimeout(this.filterTimeout)
    this.filterTimeout = setTimeout(() => {
      this._applyFilter()
      this.filterTimeout = null
    }, 1000)
  }
  _applyFilter() {
    const filtered: string[] = []
    const indexOf = (item: string[] | string, filter: string) => {
      if (Array.isArray(item)) return item.findIndex(entry => filter.toLowerCase() === entry.toLowerCase())
      return item.toLowerCase().indexOf(filter.toLowerCase())
    }
    for (const id in this.assets) {
      if (this.type === 'all') {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter) {
            filtered.push(id)
        }
      } else if (this.type === 'tilt' && this.assets[id].tags.indexOf('tilt') !== -1) {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter
          ) {
            filtered.push(id)
        }
      } else if (this.type === '3d' && this.assets[id].tags.indexOf('tilt') === -1) {
        if (this.filter === '' ||
          indexOf(this.assets[id].tags, this.filter) !== -1 ||
          indexOf(this.assets[id].name, this.filter) !== -1 ||
          this.assets[id].authorId === this.filter
          ) {
            filtered.push(id)
        }
      }
    }
    this.items = filtered
  }
  override mutated() {
    const size = parseInt(this.size) || 128
    const powTwoSize = Math.max(32, Math.min(512, nearestPowerOfTwo(size)))
    const columnCount = Math.max(1, Math.ceil(this.clientWidth / size))

    const itemSize = this.clientWidth / columnCount - 1 / columnCount
    const firstIndex = Math.floor(this.scrollTop / itemSize)

    const visibleListSize = Math.round(this.clientHeight / itemSize) * columnCount + 4 * columnCount
    const visibleList = this.items.slice(
      firstIndex * columnCount,
      firstIndex * columnCount + visibleListSize
    )

    const top = firstIndex * itemSize
    const height = this.items.length * itemSize / columnCount

    this.style.setProperty('--polyGalleryCellSize', `${itemSize}px`)
    this.style.setProperty('--polyGalleryHeight', `${height}px`)
    this.style.setProperty('--polyGalleryTop', `${top}px`)

    this.render([
      div({ class: 'height-padding' }),
      div({ class: 'top-padding' }),
      ...visibleList.map((item: string) => polyThumbnail({
        guid: item,
        thumbnails: this.thumbnails,
        size: powTwoSize,
      })),
    ])
  }
}

export const polyGallery = function(props: PolyGalleryProps) {
  return PolyGallery.vConstructor(props)
}