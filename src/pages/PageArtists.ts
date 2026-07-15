import { div, Property, ReactiveElement, ReactiveElementProps, Register, ThemeSingleton } from '@io-gui/core'
import { polyLink } from '../views/PolyLink.js'
import { BLOB_URL } from '../constants.js'

type Artist = {
  name: string
  assets: string[]
}

@Register
export class PageArtists extends ReactiveElement {
  static override get Style() {
    return /* css */`
      :host {
        display: block;
        position: relative;
        overflow-y: scroll;
        height: 100%;
        width: 100%;
        padding: 0 var(--io_spacing3);
      }
      :host > .height-padding {
        display: block;
        position: absolute;
        width: 1px;
        height: var(--pageArtistsHeight);
      }
      :host > .top-padding {
        display: block;
        height: var(--pageArtistsTop);
        margin-top: var(--io_lineHeight);
      }
      @keyframes spinner {
      to {transform: rotate(360deg);}
    }
    :host[loading] {
      background-image: repeating-linear-gradient(135deg, var(--io_bgColorLight), var(--io_bgColor) 3px, var(--io_bgColor) 7px, var(--io_bgColorLight) 10px) !important;
      background-repeat: repeat;
      position: relative;
    }
    :host[loading]:after {
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
      border-top-color: var(--io_colorBlue);
      animation: spinner .6s linear infinite;
    }
    `
  }

  @Property({ type: String, value: `${BLOB_URL}/data/artists.csv` })
  declare src: string

  @Property({ value: false, reflect: true })
  declare loading: boolean

  artists: Record<string, Artist> = {}
  ids: string[] = []

  static override get Listeners() {
    return {
      scroll: 'onScroll',
    }
  }

  ready() {
    this.srcChanged()
  }

  srcChanged() {
    this.artists = {}
    this.ids = []
    this.loading = true
    fetch(this.src)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`${response.url} ${response.status} ${response.statusText}`)
      }
      return response.text()
    })
    .then((data) => {
      const rows = data.split('\n')
      rows.length = rows.length - 1
      for (let i = 0; i < rows.length; i++) {
        const data = rows[i].split(',')
        this.artists[data[0]] = {
          name: data[1],
          assets: []
        }
        for (let i = 2; i < data.length; i++) {
          this.artists[data[0]].assets.push(data[i])
        }
      }
      this.ids = Object.keys(this.artists).sort((a, b) => {
        if (this.artists[a].name?.toLowerCase() < this.artists[b].name?.toLowerCase()) return -1
        if (this.artists[a].name?.toLowerCase() > this.artists[b].name?.toLowerCase()) return 1
        return 0
      })
      this.loading = false
      this.mutated()
    })
    .catch(console.error)
  }
  onResized() {
    this.throttle(this.mutated)
  }
  onScroll() {
    this.throttle(this.mutated)
  }
  override mutated() {
    const itemSize = this.querySelector('poly-link')?.clientHeight || ThemeSingleton.lineHeight
    const firstIndex = Math.max(0, Math.floor(this.scrollTop / itemSize) - 2)

    const visibleListSize = Math.round(this.clientHeight / itemSize) + 4
    const visibleList = this.ids.slice(firstIndex, firstIndex + visibleListSize)

    const top = firstIndex * itemSize
    const height = this.ids.length * itemSize

    this.style.setProperty('--pageArtistsHeight', `${height}px`)
    this.style.setProperty('--pageArtistsTop', `${top}px`)

    this.render([
      div({ class: 'height-padding' }),
      div({ class: 'top-padding' }),
      ...visibleList.map((item: string) => 
        polyLink({ value: item, label: this.artists[item].name })),
    ])
  }
}

export const pageArtists = function(props?: ReactiveElementProps) {
  return PageArtists.vConstructor(props)
}