// Poly API v1 (revision 20201006) enums and nested types.
// AssetInfo is the blob.polygone.art data.json shape (Poly Asset + archive fields).

export type PolyLicense = 'UNKNOWN' | 'CREATIVE_COMMONS_BY' | 'ALL_RIGHTS_RESERVED'

export type PolyVisibility = 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'UNLISTED' | 'PUBLIC'

export type PolyFormatType = 'FBX' | 'GLTF' | 'GLTF2' | 'OBJ' | 'TILT'

export type PolyColorSpace = 'UNKNOWN' | 'LINEAR' | 'GAMMA'

export type PolyFile = {
  relativePath: string
  contentType: string
  url?: string
}

export type PolyFormatComplexity = {
  lodHint?: number
  triangleCount?: string
}

export type PolyFormat = {
  formatType: PolyFormatType
  root: PolyFile
  resources?: PolyFile[]
  formatComplexity?: PolyFormatComplexity
}

export type PolyQuaternion = {
  x?: number
  y?: number
  z?: number
  w?: number
}

export type PolyPresentationParams = {
  backgroundColor?: string
  colorSpace?: PolyColorSpace
  orientingRotation?: PolyQuaternion
}

export type AssetInfo = {
  name: string
  description: string
  authorId: string
  authorName: string
  createTime: string
  updateTime: string
  license: PolyLicense
  visibility: PolyVisibility
  tags: string[]
  likes: number
  formats: PolyFormat[]
  presentationParams: PolyPresentationParams
}
