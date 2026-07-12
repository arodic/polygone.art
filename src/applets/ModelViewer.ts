import { Property, Register } from '@io-gui/core'
import { ThreeApplet } from '@io-gui/three'
import { Color, GridHelper, LinearSRGBColorSpace, Mesh, Object3D, PerspectiveCamera, WebGPURenderer } from 'three/webgpu'
import { BLOB_URL } from '../constants.js'
// import { Environment } from '../models/Environment.js'
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

export const BRUSH_PATH = '/assets/brushes/';

@Register
export class ModelViewer extends ThreeApplet {

  @Property({ type: AssetInfo })
  declare assetInfo: AssetInfo

  // @Property({ type: Environment, init: {path: './assets/hdr/monochrome_studio_02_1k.hdr'} })
  // declare environment: Environment

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
    renderer.outputColorSpace = LinearSRGBColorSpace;
    // this.environment.initPMREMGeneratorWithRenderer(renderer)
    // this.scene.environment = this.environment.texture
    // this.scene.environmentIntensity = 0.25
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
    const ambient = this.scene.getObjectByName('SceneAmbient')
    if (ambient) this.scene.remove(ambient)
    this.isPlaying = false
    this.scene.fog = null
  }

  loadGLTF2Model(url: string) {
    gltfLoader.load(url, (gltf) => {
      this.modelRoot.add(gltf.scene)
      // TODO: Design a better API for this
      this.dispatch('three-applet-frame-object-all', gltf.scene, true)
      this.dispatch('three-applet-needs-render', undefined, true)
    })
    this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`)
  }

  async loadLegacyGLTFModelWithTiltMaterials(url: string) {
    
    this.loadPresentation(`${BLOB_URL}/assets/${this.assetInfo.guid}/presentation.json`)

    const gltf = await legacyLoader.loadAsync(url)
    this.modelRoot.add(gltf.scene)

    await replaceGltf1Materials(gltf.scene, BRUSH_PATH)

    const { ambient, fog } = await tiltEnvironmentLoader.load(gltf.scene, gltf.scene.userData)
    this.scene.add(ambient)
    this.scene.fog = fog

    this.isPlaying = true

    this.dispatch('three-applet-needs-render', undefined, true)
  }

  async loadPresentation(jsonUrl: string) {
    const presentation = await presentationLoader.load(jsonUrl)
    if (presentation) {
      this.camera.fov = presentation.yfovDeg
      this.camera.near = presentation.znear
      this.camera.far = 6000
      this.camera.position.fromArray([...presentation.translation])
      this.camera.quaternion.fromArray([...presentation.rotation])
      this.camera.updateProjectionMatrix()
    } else {
      this.dispatch('three-applet-frame-object-all', this.modelRoot, true)
    }
    this.dispatch('three-applet-needs-render', undefined, true)
  }
}