import { div, h4, Property, Register, ReactiveElement, ReactiveElementProps, span, WithBinding } from '@io-gui/core'
import { ioButton } from '@io-gui/inputs'
import { AssetInfo } from '../models/AssetInfo'
import { polyLink } from '../poly-link'
import { BLOB_URL } from '../constants'

type AssetInfoViewProps = ReactiveElementProps & {
  assetInfo: AssetInfo
  guid: WithBinding<string>
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
      :host .info {
        background: var(--io_bgColorStrong);
      }
      :host poly-link {
        display: inline-block;
        margin: 0 var(--io_spacing);
      }
      
      :host .info > span {
        display: block;
        opacity: 0.5;
        margin-top: var(--io_spacing2);
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
        font-weight: bold;
        border-top: var(--io_border);
        border-bottom: var(--io_border);
        margin-bottom: var(--io_spacing);
      }
      :host h4 {
        margin: var(--io_spacing3) 0;
      }
    `
  }

  @Property({ type: AssetInfo})
  declare assetInfo: AssetInfo

  @Property({ type: String, init: '' })
  declare guid: string

  onDownloadClicked(value: any) {
    window.open(value as string, '_blank')
  }

  ready() {
    this.assetInfoMutated()
  }

  assetInfoMutated() {
    this.render([
      div({ class: 'info' }, [
        `${this.assetInfo.name} by `,
        polyLink({ value: this.assetInfo.authorId, label: this.assetInfo.authorName }),
        span(new Date(this.assetInfo.createTime).toDateString()),
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
            value: `${BLOB_URL}/archives/${this.guid}/${this.guid}_${format.formatType}.zip`,
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