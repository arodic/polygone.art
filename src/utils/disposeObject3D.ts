import { Material, Object3D, Texture } from 'three/webgpu'

const SHARED_DEFAULT_TEXTURE_NAMES = new Set([
  'DefaultWhiteTexture',
  'DefaultNormalTexture',
])

const MATERIAL_TEXTURE_KEYS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
] as const

function isDisposableTexture(value: unknown): value is Texture {
  return !!value && typeof value === 'object' && (value as Texture).isTexture === true
}

function shouldDisposeTexture(texture: Texture) {
  return !SHARED_DEFAULT_TEXTURE_NAMES.has(texture.name)
}

function disposeTextureValue(value: unknown, disposedTextures: Set<Texture>) {
  if (!isDisposableTexture(value) || disposedTextures.has(value)) return
  if (!shouldDisposeTexture(value)) return
  disposedTextures.add(value)
  value.dispose()
}

function disposeMaterial(material: Material, disposedMaterials: Set<Material>, disposedTextures: Set<Texture>) {
  if (disposedMaterials.has(material)) return
  disposedMaterials.add(material)

  const mat = material as Material & {
    uniforms?: Record<string, { value?: unknown }>
  }

  for (const key of MATERIAL_TEXTURE_KEYS) {
    disposeTextureValue((mat as unknown as Record<string, unknown>)[key], disposedTextures)
  }

  if (mat.uniforms) {
    for (const uniform of Object.values(mat.uniforms)) {
      disposeTextureValue(uniform?.value, disposedTextures)
    }
  }

  material.dispose()
}

/**
 * Remove an object from its parent and dispose geometries, materials, and textures.
 * Shared materials/textures are disposed once.
 */
export function disposeObject3D(root: Object3D) {
  const disposedGeometries = new Set<object>()
  const disposedMaterials = new Set<Material>()
  const disposedTextures = new Set<Texture>()

  root.traverse((child) => {
    const obj = child as Object3D & {
      geometry?: { dispose: () => void }
      material?: Material | Material[]
      onBeforeRender?: unknown
    }

    if (typeof obj.onBeforeRender === 'function') {
      obj.onBeforeRender = () => {}
    }

    if (obj.geometry && !disposedGeometries.has(obj.geometry)) {
      disposedGeometries.add(obj.geometry)
      obj.geometry.dispose()
    }

    if (!obj.material) return
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const material of materials) {
      if (material) disposeMaterial(material, disposedMaterials, disposedTextures)
    }
  })

  root.removeFromParent()
}
