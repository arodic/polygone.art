import { TextureLoader } from 'three/webgpu'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'

export const textureLoader = new TextureLoader()
export const gltfLoader = new GLTFLoader()
export const hdrLoader = new HDRLoader()