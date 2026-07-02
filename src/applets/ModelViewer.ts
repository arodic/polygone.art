import { Property, Register, rt } from "@io-gui/core";
import { ThreeApplet } from "@io-gui/three";
import { Color, GridHelper, Mesh, Object3D, WebGPURenderer } from 'three/webgpu';
import { BLOB_URL } from '../constants.js'
import { gltfLoader } from '../utils/loaders';
import { Environment } from '../models/Environment.js';
import { AssetInfo } from "../models/AssetInfo";


@Register
export class ModelViewer extends ThreeApplet {

  @Property({ type: AssetInfo })
  declare assetInfo: AssetInfo

  @Property({ type: Environment, init: {path: './images/env/monochrome_studio_02_1k.hdr'} })
  declare environment: Environment

  @Property({ type: Object3D, init: null })
  declare modelRoot: Object3D

  @Property({ type: GridHelper, init: [10, 10] })
  declare gridHelper: GridHelper

  constructor(assetInfo: AssetInfo) {
    super()
    this.assetInfo = assetInfo
    this.scene.add(this.modelRoot)
    this.scene.add(this.gridHelper)
  }

  onRendererInitialized(renderer: WebGPURenderer) {
    this.environment.initPMREMGeneratorWithRenderer(renderer)
    this.scene.environment = this.environment.texture
    this.scene.environmentIntensity = 0.25
  }

  assetInfoMutated() {
    this.clearModel()
    this.loadModel()
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
  }

  loadModel() {

    const bgColor = this.assetInfo?.presentationParams?.backgroundColor || '#000000'
    this.scene.background = new Color(Number(bgColor.replace('#', '0x')))

    if (this.assetInfo.guid) {
      const gltf2model = this.assetInfo?.formats.find((format) => format.formatType === 'GLTF2')
      const fltf2Root = gltf2model?.root?.relativePath
      if (fltf2Root) {
        gltfLoader.load(`${BLOB_URL}/assets/${this.assetInfo.guid}/GLTF2/${fltf2Root}`, (gltf) => {
          this.modelRoot.add(gltf.scene)
          // TODO: Design a better API for this
          this.dispatch('three-applet-frame-object-all', gltf.scene, true)
          this.dispatch('three-applet-needs-render', undefined, true)
        })    
      }
  
    }

  }
}