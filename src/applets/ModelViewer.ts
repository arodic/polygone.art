import { Property, Register } from '@io-gui/core'
import { ThreeApplet } from '@io-gui/three'
import { AmbientLight, Color, DirectionalLight, GridHelper, LinearSRGBColorSpace, Mesh, Object3D, PerspectiveCamera, WebGPURenderer } from 'three/webgpu'
import { BLOB_URL } from '../constants.js'
import { Environment } from '../models/Environment.js'
import { AssetInfo } from '../models/AssetInfo'
import { LegacyGLTFLoader } from '../utils/LegacyGLTFLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { PresentationLoader } from '../utils/PresentationLoader.js'
import { replaceGltf1Materials } from '../utils/replaceGltf1Materials.js'
import { TiltEnvironmentLoader } from '../utils/TiltEnvironmentLoader.js'

const gltfLoader = new GLTFLoader()
const presentationLoader = new PresentationLoader()
const legacyLoader = new LegacyGLTFLoader()
const tiltEnvironmentLoader = new TiltEnvironmentLoader()

export const BRUSH_PATH = '/assets/brushes/'

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

  @Property({ type: PerspectiveCamera, init: null })
  declare camera: PerspectiveCamera

  constructor(assetInfo: AssetInfo) {
    super()
    this.assetInfo = assetInfo
    this.scene.add(this.modelRoot)
    this.scene.add(this.gridHelper)
    this.scene.add(this.camera)
  }

  onRendererInitialized(renderer: WebGPURenderer) {
    renderer.outputColorSpace = LinearSRGBColorSpace
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
      this.loadGLTF2Model(url)
    } else if (gltf && tilt) {
      const url = `${BLOB_URL}/assets/${this.assetInfo.guid}/GLTF/${gltf.root.relativePath}`
      this.loadLegacyGLTFModelWithTiltMaterials(url)
    }
  }

  clearModel() {
    const model = this.modelRoot.children[0]
    if (model) {
      this.modelRoot.remove(model)
      model.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose()
          child.material.dispose()
        }
      })
    }
    this.isPlaying = false
    this.scene.fog = null
  }

  async loadGLTF2Model(url: string) {
    const hasPresentation = await this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`)

    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = 0.25

    const gltf = await gltfLoader.loadAsync(url)

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
    const hasPresentation = await this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`)

    this.scene.environment = null
    this.scene.environmentIntensity = 0

    const gltf = await legacyLoader.loadAsync(url)
    await replaceGltf1Materials(gltf.scene, BRUSH_PATH)
    this.modelRoot.add(gltf.scene)

    const { ambient, fog } = await tiltEnvironmentLoader.load(gltf.scene, gltf.scene.userData)
    this.modelRoot.add(ambient)
    this.scene.fog = fog

    this.isPlaying = true

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
      this.dispatch('three-applet-needs-render', undefined, true)
      return true
    }
    this.dispatch('three-applet-needs-render', undefined, true)
    return false
  }
}