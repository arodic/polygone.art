import { Box3, Vector3 } from 'three/webgpu';
const _box = new Box3();
const _center = new Vector3();
const _origin = new Vector3();
const _direction = new Vector3();
const _toPoint = new Vector3();
/** World-space view-center ray from a camera (origin + normalized forward). */
export function getCameraViewCenterRay(camera, origin = new Vector3(), direction = new Vector3()) {
    camera.getWorldPosition(origin);
    camera.getWorldDirection(direction);
    return { origin, direction };
}
/** Closest point on an infinite ray to a world-space point. */
export function closestPointOnRayToPoint(rayOrigin, rayDirection, point, target = new Vector3()) {
    _toPoint.subVectors(point, rayOrigin);
    const t = rayDirection.dot(_toPoint);
    return target.copy(rayOrigin).addScaledVector(rayDirection, t);
}
/** Axis-aligned bounding box center of an object hierarchy. */
export function getObjectBoundingCenter(object, target = new Vector3()) {
    _box.setFromObject(object, true);
    if (_box.isEmpty())
        return target.set(0, 0, 0);
    return _box.getCenter(target);
}
/**
 * Orbit target for presentation camera framing:
 * closest point on the view-center ray to the model bounding-box center.
 */
export function computeOrbitTargetFromCameraAndModel(camera, modelRoot, target = new Vector3()) {
    const modelCenter = getObjectBoundingCenter(modelRoot, _center);
    getCameraViewCenterRay(camera, _origin, _direction);
    return closestPointOnRayToPoint(_origin, _direction, modelCenter, target);
}
