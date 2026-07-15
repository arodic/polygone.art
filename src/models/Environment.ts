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

  /** PMREM cubemap; null until HDR load + PMREM generation finish. */
  @Property({ type: Texture, value: null })
  declare texture: Texture | null

  @Field(0)
  declare _loadGeneration: number

  private _pmremGenerator: PMREMGenerator | null = null
  private _pmremTarget: RenderTarget | null = null
  private _resolveReady: ((texture: Texture | null) => void) | null = null
  private _ready: Promise<Texture | null> = this._createReadyPromise()

  constructor(args: EnvironmentProps) {
    super(args)
  }

  /**
   * Resolves with the PMREM texture once available, or null if the current
   * HDR load fails / is cancelled. Already-ready environments resolve immediately.
   */
  whenReady(): Promise<Texture | null> {
    if (this.texture) return Promise.resolve(this.texture)
    return this._ready
  }

  pathChanged() {
    hdrLoader.manager.abort()

    const generation = ++this._loadGeneration
    this._settleReady(null)
    this._ready = this._createReadyPromise()
    this._disposePmremTarget()
    this.texture = null
    this.rawTexture?.dispose()
    this.rawTexture = undefined

    const path = this.path
    if (!path) {
      this._settleReady(null)
      return
    }

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
        this._settleReady(null)
      },
    )
  }

  generateTextureFromRawTexture() {
    if (this._pmremGenerator === null) return
    if (this.rawTexture === undefined) return
    this._disposePmremTarget()
    this._pmremTarget = this._pmremGenerator.fromEquirectangular(this.rawTexture)
    this.texture = this._pmremTarget.texture
    this._settleReady(this.texture)
  }

  initPMREMGeneratorWithRenderer(renderer: WebGPURenderer): void {
    if (this._pmremGenerator !== null) return
    this._pmremGenerator = new PMREMGenerator(renderer)
    this.generateTextureFromRawTexture()
  }

  private _createReadyPromise(): Promise<Texture | null> {
    return new Promise<Texture | null>(resolve => {
      this._resolveReady = resolve
    })
  }

  private _settleReady(texture: Texture | null) {
    const resolve = this._resolveReady
    this._resolveReady = null
    resolve?.(texture)
  }

  private _disposePmremTarget() {
    this._pmremTarget?.dispose()
    this._pmremTarget = null
  }
}
