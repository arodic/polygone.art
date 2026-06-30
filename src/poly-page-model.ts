 
import { div, h4, li, Property, ReactiveElement, ReactiveElementProps, Register, span, ul, a, WithBinding, Color } from '@io-gui/core'
import { polyLink } from './poly-link.js'
// import { polyViewer } from './poly-viewer.js'
import { BLOB_URL } from './constants.js'
import type { AssetInfo } from './types/AssetInfo'

import { IoThreeViewport, ioThreeViewport, ThreeApplet } from '@io-gui/three';
import { AmbientLight, Scene } from 'three/webgpu';
import { gltfLoader } from './utils/loaders';

// const cachedAssets: Record<string, AssetInfo> = {}

const applet = new ThreeApplet({
  scene: new Scene(),
  // isPlaying: true
});
applet.scene.add(new AmbientLight(0xffffff, 1))

type PolyViewerProps = ReactiveElementProps & {
  guid: WithBinding<string>
}

const cachedAssets: Record<string, AssetInfo> = {}

type PolyPageModelProps = ReactiveElementProps & {
  guid: WithBinding<string>
}

@Register
export class PolyPageModel extends ReactiveElement {
  static override get Style() {
    return /* css */`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      padding: var(--io_spacing3) var(--io_lineHeight);
      line-height: 1.4em;
      max-width: 512px;
      color: var(--io_color);
    }
    :host poly-viewer {
      width: 100%;
      height: var(--polyViewerHeight);
    }
    :host .info {
      background: var(--io_bgColorStrong);
      padding: var(--io_spacing);
      margin: 0;
    }
    :host .description {
      padding: var(--io_spacing) 0;
    }
    :host .license {
      border-top: var(--io_border);
      border-bottom: var(--io_border);
      padding: var(--io_spacing) 0;
      margin-bottom: var(--io_spacing);
    }
    :host .info :last-child {
      float: right;
      opacity: 0.5;
    }
    :host h4 {
      margin: 0;
    }
    :host .downloads,
    :host .tags {
      margin: 0;
      padding: 0.5em;
    }
    :host .downloads > li,
    :host .tags > li {
      display: inline-block;
      margin-right: 0.5em;
    }
    `
  }

  @Property('')
  declare guid: string

  @Property({ value: null })
  declare assetInfo: AssetInfo | null

  onResized() {
    const height = Math.min(this.clientWidth, 512) / 1.333
    this.style.setProperty('--polyViewerHeight', `${height}px`)
  }

  guidChanged() {
    if (cachedAssets[this.guid]) {
      this.assetInfo = cachedAssets[this.guid]
      this.mutated()
    } else if (this.guid) {
      fetch(`${BLOB_URL}/assets/${this.guid}/data.json`).then(async response => {
        const assetInfo = await response.json() as AssetInfo
        this.assetInfo = assetInfo
        cachedAssets[this.guid] = assetInfo
        this.mutated()
      })
      fetch(`${BLOB_URL}/guid/${this.guid}`)
    } else {
      this.assetInfo = null
      this.mutated()
    }
  }

  override mutated() {
    if (!this.assetInfo) {
      this.render([])
      return
    }

    this.render([
      // polyViewer({ guid: this.guid }),
      ioThreeViewport({id: 'viewport', applet: applet}),
      div({ class: 'info' }, [
        span(`${this.assetInfo.name} by `),
        polyLink({ value: this.assetInfo.authorId, label: this.assetInfo.authorName }),
        span(new Date(this.assetInfo.createTime).toDateString()),
      ]),
      div({ class: 'description' },
        `${this.assetInfo.description || ''}`
      ),
      div({ class: 'license' },
        'This content is published under a CC-BY license. You\'re free to use this as long as you credit the author.'
      ),
      this.assetInfo.tags.length ? h4('Tags:') : null,
      ul({ class: 'tags' }, this.assetInfo.tags.map((tag: string) =>
        li([
          polyLink({ value: tag, label: tag }),
        ])
      )),
      h4('Downloads:'),
      ul({ class: 'downloads' }, this.assetInfo.formats.map(format =>
        li([
          a({ href: `${BLOB_URL}/archives/${this.guid}/${this.guid}_${format.formatType}.zip` }, `${format.formatType} ⇩`),
        ])
      )),
    ])

    const viewport = (this.$['viewport'] as IoThreeViewport)

    // TODO: Clear scene
    if (this.guid) {
      fetch(`${BLOB_URL}/assets/${this.guid}/data.json`).then(async response => {
        const assetInfo = await response.json() as AssetInfo

        const bgColor = assetInfo?.presentationParams?.backgroundColor || '#000000'

        viewport.clearColor = Number(bgColor.replace('#', '0x'))

        const gltf2model = assetInfo.formats.find(format => format.formatType === 'GLTF2')
        const fltf2Root = gltf2model?.root?.relativePath

        gltfLoader.load(`${BLOB_URL}/assets/${this.guid}/GLTF2/${fltf2Root}`, (gltf) => {
          applet.scene.add(gltf.scene)
          viewport.viewCameras.frameObjectAll(gltf.scene)
          // TODO: Design a better API for this
          applet.dispatch('three-applet-needs-render', undefined, true)
        })
      })
    }
  }
}

export const polyPageModel = function(props: PolyPageModelProps) {
  return PolyPageModel.vConstructor(props)
}