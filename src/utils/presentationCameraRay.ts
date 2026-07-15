import { Box3, Camera, Mesh, Object3D, Vector3 } from 'three/webgpu'

/** Set on tilt environment roots so framing ignores pedestal/sky bounds. */
export const EXCLUDE_FROM_CAMERA_BOUNDS = 'excludeFromCameraBounds'

/** Minimum pivot distance along the view ray (avoids lookAt(self) / unstable orbit radius). */
const MIN_FOCUS_DISTANCE = 0.05

const _box = new Box3()
const _meshBox = new Box3()
const _size = new Vector3()
const _center = new Vector3()
const _origin = new Vector3()
const _direction = new Vector3()
const _toPoint = new Vector3()

/** World-space view-center ray from a camera (origin + normalized forward). */
export function getCameraViewCenterRay(
  camera: Camera,
  origin: Vector3 = new Vector3(),
  direction: Vector3 = new Vector3(),
) {
  camera.getWorldPosition(origin)
  camera.getWorldDirection(direction)
  return { origin, direction }
}

/**
 * Point on the camera view half-ray used as orbit/FPS pivot.
 * Always keeps `t >= minDistance` so OrbitControls.lookAt cannot flip or degenerate.
 */
export function closestPointOnRayToPoint(
  rayOrigin: Vector3,
  rayDirection: Vector3,
  point: Vector3,
  target: Vector3 = new Vector3(),
  minDistance = MIN_FOCUS_DISTANCE,
) {
  _toPoint.subVectors(point, rayOrigin)
  const t = Math.max(minDistance, rayDirection.dot(_toPoint))
  return target.copy(rayOrigin).addScaledVector(rayDirection, t)
}

/** Place `target` ahead of the camera on the view-center ray. */
export function placeTargetOnCameraViewRay(
  camera: Camera,
  target: Vector3,
  distance = 1,
) {
  getCameraViewCenterRay(camera, _origin, _direction)
  return target.copy(_origin).addScaledVector(_direction, Math.max(distance, MIN_FOCUS_DISTANCE))
}

/** Expand an AABB over mesh geometry, skipping `excludeFromCameraBounds` subtrees. */
export function expandBoxFromObject(object: Object3D, box: Box3) {
  if (object.userData?.[EXCLUDE_FROM_CAMERA_BOUNDS]) return

  if ((object as Mesh).isMesh) {
    const mesh = object as Mesh
    const geometry = mesh.geometry
    if (geometry) {
      if (!geometry.boundingBox) geometry.computeBoundingBox()
      if (geometry.boundingBox && !geometry.boundingBox.isEmpty()) {
        _meshBox.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld)
        box.union(_meshBox)
      }
    }
  }

  for (const child of object.children) {
    expandBoxFromObject(child, box)
  }
}

/** Axis-aligned bounding box center of an object hierarchy (env-excluded). */
export function getObjectBoundingCenter(object: Object3D, target: Vector3 = new Vector3()) {
  object.updateWorldMatrix(true, true)
  _box.makeEmpty()
  expandBoxFromObject(object, _box)
  if (_box.isEmpty()) return target.set(0, 0, 0)
  return _box.getCenter(target)
}

/**
 * Orbit / FPS pivot for presentation camera framing:
 * closest point on the view-center half-ray to the model bounding-box center.
 * Does not modify the camera.
 */
export function computeOrbitTargetFromCameraAndModel(
  camera: Camera,
  modelRoot: Object3D,
  target: Vector3 = new Vector3(),
) {
  getObjectBoundingCenter(modelRoot, _center)
  getCameraViewCenterRay(camera, _origin, _direction)
  // If the center projects behind the camera, fall back to a radius-scale distance ahead.
  _toPoint.subVectors(_center, _origin)
  let minDistance = MIN_FOCUS_DISTANCE
  if (_direction.dot(_toPoint) < MIN_FOCUS_DISTANCE && !_box.isEmpty()) {
    minDistance = Math.max(MIN_FOCUS_DISTANCE, _box.getSize(_size).length() * 0.25)
  }
  return closestPointOnRayToPoint(_origin, _direction, _center, target, minDistance)
}
