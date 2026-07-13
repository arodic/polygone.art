import { Camera, Object3D, Vector3 } from 'three/webgpu';
/** World-space view-center ray from a camera (origin + normalized forward). */
export declare function getCameraViewCenterRay(camera: Camera, origin?: Vector3, direction?: Vector3): {
    origin: Vector3;
    direction: Vector3;
};
/** Closest point on an infinite ray to a world-space point. */
export declare function closestPointOnRayToPoint(rayOrigin: Vector3, rayDirection: Vector3, point: Vector3, target?: Vector3): Vector3;
/** Axis-aligned bounding box center of an object hierarchy. */
export declare function getObjectBoundingCenter(object: Object3D, target?: Vector3): Vector3;
/**
 * Orbit target for presentation camera framing:
 * closest point on the view-center ray to the model bounding-box center.
 */
export declare function computeOrbitTargetFromCameraAndModel(camera: Camera, modelRoot: Object3D, target?: Vector3): Vector3;
