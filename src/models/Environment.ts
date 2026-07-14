import { Property, ReactiveObject, ReactiveObjectProps, Register, Field } from '@io-gui/core'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import {
  EquirectangularReflectionMapping,
  PMREMGenerator,
  RenderTarget,
  WebGPURenderer,
  Texture,
} from 'three/webgpu'

const hdrLoader = new HDRLoader()

export type EnvironmentProps = ReactiveObjectProps & {
  path?: string
}

@Register
export class Environment extends ReactiveObject {

  @Property({ type: String, init: null })
  declare path: string

  @Property({ type: Texture })
  declare rawTexture: Texture | undefined

  @Property({ type: Texture, init: null })
  declare texture: Texture

  @Field(0)
  declare _loadGeneration: number

  private _pmremGenerator: PMREMGenerator | null = null
  private _pmremTarget: RenderTarget | null = null

  constructor(args: EnvironmentProps) {
    super(args)
  }

  pathChanged() {
    hdrLoader.manager.abort()

    const generation = ++this._loadGeneration
    const path = this.path

    hdrLoader.load(
      path,
      rawTexture => {
        if (generation !== this._loadGeneration) {
          rawTexture.dispose()
          return
        }
        rawTexture.mapping = EquirectangularReflectionMapping
        this.rawTexture?.dispose()
        this.rawTexture = rawTexture
        this.generateTextureFromRawTexture()
      },
      undefined,
      err => {
        if (generation !== this._loadGeneration) return
        console.error('Polygone HDR failed', path, err)
      },
    )
  }

  generateTextureFromRawTexture() {
    if (this._pmremGenerator === null) return
    if (this.rawTexture === undefined) return
    this._pmremTarget?.dispose()
    this._pmremTarget = this._pmremGenerator.fromEquirectangular(this.rawTexture)
    this.texture = this._pmremTarget.texture
  }

  initPMREMGeneratorWithRenderer(renderer: WebGPURenderer): void {
    if (this._pmremGenerator !== null) return
    this._pmremGenerator = new PMREMGenerator(renderer)
    this.generateTextureFromRawTexture()
  }
}
