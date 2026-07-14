import { DefaultLoadingManager, Mesh, Object3D } from 'three'
import { GLTFGoogleTiltBrushMaterialExtension } from '../tilt/GOOGLE_tilt_brush_material.js'

export async function replaceGltf1Materials(model: Object3D, brushPath: string): Promise<void> {
  const mockParser: any = {
    options: {
      manager: DefaultLoadingManager,
    },
  }
  const extension = new GLTFGoogleTiltBrushMaterialExtension(mockParser, brushPath, true)

  const meshes: Mesh[] = []
  model.traverse((object) => {
    if ((object as Mesh).isMesh) meshes.push(object as Mesh)
  })

  for (const mesh of meshes) {
    const materialName = (mesh.material as { name?: string } | undefined)?.name
    if (!materialName) continue

    let brushId = materialName.startsWith('material_') ? materialName.substring(9) : materialName
    const guidMatch = brushId.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/)
    if (guidMatch) brushId = guidMatch[0]

    try {
      await extension.replaceMaterial(mesh, brushId)
    } catch (error) {
      console.warn(`Failed to replace material for ${brushId} on mesh ${mesh.name}:`, error)
    }
  }
}