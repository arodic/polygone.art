import { Property, Register, Storage as $ } from '@io-gui/core'
import { ThreeApplet } from '@io-gui/three'
import { AmbientLight, Box3, Color, DirectionalLight, GridHelper, LinearSRGBColorSpace, Mesh, Object3D, PerspectiveCamera, Vector3, WebGPURenderer } from 'three/webgpu'
import { BLOB_URL } from '../constants.js'
import { Environment } from '../models/Environment.js'
import { AssetInfo } from '../models/AssetInfo'
import { LegacyGLTFLoader } from '../utils/LegacyGLTFLoader.js'
import { GLTFLoader } from '../utils/GLTFLoader.js'
import { PresentationLoader } from '../utils/PresentationLoader.js'
import { replaceGltf1Materials } from '../utils/replaceGltf1Materials.js'
import { TiltEnvironmentLoader } from '../utils/TiltEnvironmentLoader.js'
import { disposeObject3D } from '../utils/disposeObject3D.js'
import { cappedDevicePixelRatio } from '../utils/pixelRatio.js'

const gltfLoader = new GLTFLoader()
const presentationLoader = new PresentationLoader()
const legacyLoader = new LegacyGLTFLoader()
const tiltEnvironmentLoader = new TiltEnvironmentLoader()

export const BRUSH_PATH = '/assets/brushes/'

const $showGrid = $({key: 'grid', storage: 'local', value: false})

function sketchNeedsContinuousPlayback(root: Object3D) {
  let needsPlayback = false
  root.traverse((object) => {
    if (needsPlayback || !(object as Mesh).isMesh) return
    const material = (object as Mesh).material as {
      uniforms?: { u_time?: unknown }
      userData?: { tiltUniforms?: { u_time?: unknown } }
      positionNode?: unknown
    } | Array<unknown> | undefined
    if (!material || Array.isArray(material)) return
    // Animated Tilt brushes drive u_time and/or a custom positionNode each frame.
    if (material.uniforms?.u_time || material.userData?.tiltUniforms?.u_time || material.positionNode) {
      needsPlayback = true
    }
  })
  return needsPlayback
}

@Register
export class ModelViewer extends ThreeApplet {

  @Property({ type: AssetInfo })
  declare assetInfo: AssetInfo

  @Property({ type: Environment, init: {path: './assets/hdr/monochrome_studio_02_1k.hdr'} })
  declare environment: Environment

  @Property({ type: Object3D, init: null })
  declare modelRoot: Object3D

  @Property({ type: GridHelper, init: [10, 10] })
  declare gridHelper: GridHelper

  @Property({ binding: $showGrid, type: Boolean })
  declare showGrid: boolean

  @Property({ type: PerspectiveCamera, init: null })
  declare camera: PerspectiveCamera

  private _loadGeneration = 0

  constructor(assetInfo: AssetInfo) {
    super()
    this.assetInfo = assetInfo
    this.scene.add(this.modelRoot)
    this.scene.add(this.gridHelper)
    this.scene.add(this.camera)
    this.showGridChanged()
  }

  showGridChanged() {
    this.gridHelper.visible = this.showGrid
    this.dispatch('three-applet-needs-render', undefined, true)
  }

  onRendererInitialized(renderer: WebGPURenderer) {
    renderer.outputColorSpace = LinearSRGBColorSpace
    renderer.setPixelRatio(cappedDevicePixelRatio())
    this.environment.initPMREMGeneratorWithRenderer(renderer)
  }

  assetInfoMutated() {
    this.clearModel()
    const bgColor = this.assetInfo?.presentationParams?.backgroundColor || '#000000'
    this.scene.background = new Color(Number(bgColor.replace('#', '0x')))
    //TODO: Load presentation.json and apply presentation to the scene

    const gltf2 = this.assetInfo?.formats?.find((format) => format.formatType === 'GLTF2' && format.root?.relativePath)
    const gltf = this.assetInfo?.formats?.find((format) => format.formatType === 'GLTF' && format.root?.relativePath)
    const tilt = this.assetInfo?.formats?.find((format) => format.formatType === 'TILT' && format.root?.relativePath)
    if (gltf2) {
      const url = `${BLOB_URL}/assets/${this.assetInfo.guid}/GLTF2/${gltf2.root.relativePath}`
      void this.loadGLTF2Model(url)
    } else if (gltf && tilt) {
      const url = `${BLOB_URL}/assets/${this.assetInfo.guid}/GLTF/${gltf.root.relativePath}`
      void this.loadLegacyGLTFModelWithTiltMaterials(url)
    }
  }

  clearModel() {
    this._loadGeneration++
    while (this.modelRoot.children.length > 0) {
      disposeObject3D(this.modelRoot.children[0])
    }
    this.isPlaying = false
    this.scene.fog = null
    this.scene.environment = null
    this.scene.environmentIntensity = 0
  }

  async loadGLTF2Model(url: string) {
    const loadId = this._loadGeneration
    const [hasPresentation, envTexture, gltf] = await Promise.all([
      this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`),
      this.environment.whenReady(),
      gltfLoader.loadAsync(url, (event) => {
        if (!event.lengthComputable || event.total <= 0) return
        const progress = Math.round((event.loaded / event.total) * 100)
        this.assetInfo.dispatch('model-viewer-progress', progress, true)
      }),
    ])
    if (loadId !== this._loadGeneration) {
      disposeObject3D(gltf.scene)
      return
    }

    this.scene.environment = envTexture
    this.scene.environmentIntensity = envTexture ? 0.25 : 0

    // expand far by bounding box
    // TODO refactor in presentation/focus code
    const boundingBox = new Box3().setFromObject(gltf.scene)
    const size = boundingBox.getSize(new Vector3()).length()
    this.camera.far = Math.max(this.camera.far, size * 2)
    this.camera.near = Math.max(this.camera.near, this.camera.far / 100000)

    const ambient = new AmbientLight(0xffffff, 0.5)
    gltf.scene.add(ambient)

    const light0 = new DirectionalLight(0xffffff, 2)
    light0.position.set(15, 5, -5).normalize()
    gltf.scene.add(light0)

    const light1 = new DirectionalLight(0xffffff, 4)
    light1.position.set(-10, 2, 5).normalize()
    gltf.scene.add(light1)

    this.modelRoot.add(gltf.scene)
    if (!hasPresentation) {
      this.dispatch('three-applet-frame-object-all', this.modelRoot, true)
    }
    this.dispatch('model-viewer-ready', undefined, true)
    this.dispatch('three-applet-needs-render', undefined, true)
  }

  async loadLegacyGLTFModelWithTiltMaterials(url: string) {
    const loadId = this._loadGeneration
    const hasPresentation = await this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`)
    if (loadId !== this._loadGeneration) return

    this.scene.environment = null
    this.scene.environmentIntensity = 0

    const gltf = await legacyLoader.loadAsync(url, (event) => {
      if (!event.lengthComputable || event.total <= 0) return
      const progress = Math.round((event.loaded / event.total) * 100)
      this.assetInfo.dispatch('model-viewer-progress', progress, true)
    })
    if (loadId !== this._loadGeneration) {
      disposeObject3D(gltf.scene)
      return
    }

    await replaceGltf1Materials(gltf.scene, BRUSH_PATH)
    if (loadId !== this._loadGeneration) {
      disposeObject3D(gltf.scene)
      return
    }

    this.modelRoot.add(gltf.scene)

    const { ambient, fog } = await tiltEnvironmentLoader.load(gltf.scene, gltf.scene.userData)
    if (loadId !== this._loadGeneration) {
      disposeObject3D(gltf.scene)
      ambient.removeFromParent()
      return
    }

    this.modelRoot.add(ambient)
    this.scene.fog = fog

    this.isPlaying = sketchNeedsContinuousPlayback(gltf.scene)

    if (!hasPresentation) {
      this.dispatch('three-applet-frame-object-all', this.modelRoot, true)
    }
    this.dispatch('model-viewer-ready', undefined, true)
    this.dispatch('three-applet-needs-render', undefined, true)
  }

  async loadPresentation(jsonUrl: string): Promise<boolean> {
    const presentation = await presentationLoader.load(jsonUrl)
    if (presentation) {
      this.camera.fov = presentation.yfovDeg
      this.camera.near = presentation.znear
      this.camera.far = 6000
      this.camera.position.fromArray([...presentation.translation])
      this.camera.quaternion.fromArray([...presentation.rotation])
      this.camera.updateProjectionMatrix()
      // Let camera tools pin orbit focus onto this view ray before any lookAt runs.
      this.dispatch('model-viewer-presentation', undefined, true)
      this.dispatch('three-applet-needs-render', undefined, true)
      return true
    }
    this.dispatch('three-applet-needs-render', undefined, true)
    return false
  }

  override dispose() {
    this.clearModel()
    super.dispose()
  }
}
