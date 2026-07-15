import { div, h4, Property, Register, ReactiveElement, ReactiveElementProps, span, WithBinding } from '@io-gui/core'
import { ioButton } from '@io-gui/inputs'
import { AssetInfo } from '../models/AssetInfo'
import { polyLink } from './PolyLink'
import { BLOB_URL } from '../constants'
import { polyThumbnail } from './PolyThumbnail'

type AssetInfoViewProps = ReactiveElementProps & {
  assetInfo: WithBinding<AssetInfo>
}

@Register
export class AssetInfoView extends ReactiveElement {

  static override get Style() {
    return /* css */`
      :host {
        
      }
      :host > * {
        position: relative;
        padding: var(--io_spacing3);
        color: var(--io_color);
      }
      :host #progress {
        display: none;
        padding: 0;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: var(--io_spacing2);
        background: var(--io_bgColorBlue);
      }
      :host .info {
        display: flex;
        flex-direction: row;
        background: var(--io_bgColorStrong);
      }
      :host .info poly-thumbnail {
        flex: 0 0 64px;
        margin: 0 var(--io_spacing4) 0 0;
      }
      :host .info-text {
        display: flex;
        flex-direction: column;
        font-size: calc(0.86 * var(--io_fontSize));
      }
      :host poly-link {
        display: inline-block;
        margin: 0 var(--io_spacing);
      }
      :host .info > span {
        display: block;
        opacity: 0.5;
      }
      :host .downloads > div {
        display: block;
      }
      :host io-button {
        display: inline-block;
        margin: 0 var(--io_spacing2) 0 0 !important;
        min-width: 120px;
      }
      :host .license {
        font-size: calc(0.98 * var(--io_fontSize));
        /* font-weight: bold; */
        border-top: var(--io_border);
        border-bottom: var(--io_border);
        margin-bottom: var(--io_spacing);
      }
      :host h4 {
        margin: var(--io_spacing3) 0;
      }
    `
  }

  static override get Listeners() {
    return {
      'model-viewer-progress': 'onModelViewerProgress',
    }
  }

  @Property({ type: AssetInfo})
  declare assetInfo: AssetInfo

  onDownloadClicked(value: any) {
    window.open(value as string, '_blank')
  }

  ready() {
    this.assetInfoMutated()
  }

  onModelViewerProgress(event: CustomEvent<number>) {
    this.$['progress'].style.display = event.detail !== 100 ? 'block' : 'none'
    this.$['progress'].style.width = `${event.detail}%`
  }

  assetInfoMutated() {
    this.render([
      div({ id: 'progress' }),
      div({ class: 'info' }, [
        polyThumbnail({
          guid: this.assetInfo.guid,
          thumbnail: '',
          size: 64,
        }),
        div({ class: 'info-text' }, [
          `${this.assetInfo.name} by `,
          polyLink({ value: this.assetInfo.authorId, label: this.assetInfo.authorName }),
          span(new Date(this.assetInfo.createTime).toDateString()),
        ]),
      ]),
      div({ class: 'description' },
        `${this.assetInfo.description || ''}`
      ),
      div({ class: 'license' },
        'This content is published under a CC-BY license. You\'re free to use this as long as you credit the author.'
      ),
      this.assetInfo.tags.length ?
      div({ class: 'tags' }, [
        h4('Tags:'), ...this.assetInfo.tags.map((tag: string) =>
        polyLink({ value: tag, label: tag }))
      ]) : null,
      this.assetInfo.formats.length ?
      div({ class: 'formats' }, [
        h4('Downloads:'),
        div(this.assetInfo.formats.map(format =>
          ioButton({
            label: `${format.formatType}`, icon: 'poly:download',
            value: format.formatType === 'GLB' ?
              `${BLOB_URL}/assets/${this.assetInfo.guid}/GLB/${format.root.relativePath}` :
              `${BLOB_URL}/archives/${this.assetInfo.guid}/${this.assetInfo.guid}_${format.formatType}.zip`,
            action: this.onDownloadClicked
          }))
        )
      ]) : null,
    ])
  }
}

export const assetInfoView = function(props: AssetInfoViewProps) {
  return AssetInfoView.vConstructor(props)
}