import { Property, ReactiveObject, Register, WithBinding } from '@io-gui/core'
import { BLOB_URL } from '../constants'

// Poly API v1 (revision 20201006) enums and nested types.
// AssetInfo is the blob.polygone.art data.json shape (Poly Asset + archive fields).

type License = 'UNKNOWN' | 'CREATIVE_COMMONS_BY' | 'ALL_RIGHTS_RESERVED'

type Visibility = 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'UNLISTED' | 'PUBLIC'

type FormatType = 'FBX' | 'GLTF' | 'GLTF2' | 'OBJ' | 'TILT' | 'GLB'

type ColorSpace = 'UNKNOWN' | 'LINEAR' | 'GAMMA'

type FileInfo = {
  relativePath: string
  contentType: string
  url?: string
}

type FormatComplexity = {
  lodHint?: number
  triangleCount?: string
}

type Format = {
  formatType: FormatType
  root: FileInfo
  resources?: FileInfo[]
  formatComplexity?: FormatComplexity
}

type Quaternion = {
  x?: number
  y?: number
  z?: number
  w?: number
}

type PresentationParams = {
  backgroundColor?: string
  colorSpace?: ColorSpace
  orientingRotation?: Quaternion
}

export type AssetInfoData = {
  name: string
  description?: string
  authorId: string
  authorName: string
  createTime: string
  updateTime: string
  license: License
  visibility: Visibility
  tags: string[]
  likes: number
  formats: Format[]
  presentationParams: PresentationParams
}

const ASSET_INFO_CACHE: Map<string, AssetInfoData> = new Map()

@Register
export class AssetInfo extends ReactiveObject {

  @Property({type: String, init: ''})
  declare guid: WithBinding<string>

  @Property({type: String, init: ''})
  declare name: string

  @Property({type: String, init: ''})
  declare description: string

  @Property({type: String, init: ''})
  declare authorId: string

  @Property({type: String, init: ''})
  declare authorName: string

  @Property({type: String, init: ''})
  declare createTime: string

  @Property({type: String, init: ''})
  declare updateTime: string

  @Property({type: String, init: 'UNKNOWN'})
  declare license: License

  @Property({type: String, init: 'UNKNOWN'})
  declare visibility: Visibility

  @Property({type: Array, init: null})
  declare tags: string[]

  @Property(0)
  declare likes: number

  @Property({type: Array, init: null})
  declare formats: Format[]

  @Property({type: Object, init: null})
  declare presentationParams: PresentationParams

  guidChanged() {
    this.clear()
    if (this.guid) {
      this.load(this.guid as string).catch((error) => {
        console.error(error)
      })
    }
  }

  clear() {
    this.setProperties({
      name: '',
      description: '',
      authorId: '',
      authorName: '',
      createTime: '',
      updateTime: '',
      license: 'UNKNOWN',
      visibility: 'UNKNOWN',
      tags: [],
      likes: 0,
      formats: [],
      presentationParams: {
        backgroundColor: '#000000',
        colorSpace: 'UNKNOWN',
        orientingRotation: {
          x: 0,
          y: 0,
          z: 0,
          w: 1,
        },
      },
    }, true)
  }

  load(guid: string) {
    if (ASSET_INFO_CACHE.has(guid)) {
      this.applyJSON(ASSET_INFO_CACHE.get(guid)!)
      return Promise.resolve(this)
    } else {
      return new Promise((resolve, reject) => {
        fetch(`${BLOB_URL}/assets/${guid}/data.json`).then(async response => {
          const assetInfoData = await response.json() as AssetInfoData
          this.applyJSON(assetInfoData)
          ASSET_INFO_CACHE.set(guid, assetInfoData)
          resolve(this)
        }).catch(reject)
      })
    }
  }

  override applyJSON(assetInfoData: AssetInfoData) {
    this.setProperties({
      name: assetInfoData.name,
      description: assetInfoData.description || '',
      authorId: assetInfoData.authorId,
      authorName: assetInfoData.authorName,
      createTime: assetInfoData.createTime,
      updateTime: assetInfoData.updateTime,
      license: assetInfoData.license,
      visibility: assetInfoData.visibility,
      tags: assetInfoData.tags,
      likes: assetInfoData.likes,
      formats: assetInfoData.formats,
      presentationParams: assetInfoData.presentationParams
    })
    return this
  }

}