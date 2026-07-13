import { MeshBasicNodeMaterial } from 'three/webgpu';
import { type Texture } from 'three';
/**
 * Build a MeshBasicNodeMaterial for a supported Tilt Brush name, or null if unsupported.
 */
export declare function createNodeBrushMaterial(brushName: string, textures?: Record<string, Texture | null | undefined>, materialParams?: Record<string, any>): MeshBasicNodeMaterial | null;
export { hasNodeBrush, NODE_BRUSH_NAMES } from './brushCommon.js';
