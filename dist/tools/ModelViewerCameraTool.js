var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, Register } from '@io-gui/core';
import { ToolBase } from '@io-gui/three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Spherical, Vector3 } from 'three/webgpu';
import { VirtualThumbsticks } from '../controls/VirtualThumbsticks.js';
import { computeOrbitTargetFromCameraAndModel } from '../utils/presentationCameraRay.js';
import { bellStickCurve } from '../utils/stickCurve.js';
const ORBIT_SPEED = 1.8;
const PAN_SPEED = 1.2;
const _offset = new Vector3();
const _spherical = new Spherical();
const _right = new Vector3();
const _up = new Vector3();
const _panDelta = new Vector3();
function isCoarsePointerDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
}
let ModelViewerCameraTool = class ModelViewerCameraTool extends ToolBase {
    _registeredViewports = [];
    _viewportState = new WeakMap();
    _rafId = 0;
    _onModelReady = () => this.syncAllViewports();
    _onPointerSchemeChanged = () => this.onPointerSchemeChanged();
    constructor(args) {
        super(args);
        window.matchMedia('(pointer: coarse)').addEventListener('change', this._onPointerSchemeChanged);
        this.applet?.addEventListener('model-viewer-ready', this._onModelReady);
    }
    get modelViewer() {
        return this.applet;
    }
    registerViewport(viewport) {
        if (this._registeredViewports.includes(viewport))
            return;
        this._registeredViewports.push(viewport);
        this.setupViewport(viewport);
    }
    unregisterViewport(viewport) {
        const index = this._registeredViewports.indexOf(viewport);
        if (index === -1)
            return;
        this._registeredViewports.splice(index, 1);
        this.teardownViewport(viewport);
        if (!this._registeredViewports.length)
            this.stopAnimationLoop();
    }
    dispose() {
        window.matchMedia('(pointer: coarse)').removeEventListener('change', this._onPointerSchemeChanged);
        this.applet?.removeEventListener('model-viewer-ready', this._onModelReady);
        for (const viewport of [...this._registeredViewports]) {
            this.unregisterViewport(viewport);
        }
        this.stopAnimationLoop();
        super.dispose();
    }
    syncAllViewports() {
        for (const viewport of this._registeredViewports) {
            this.syncOrbitTarget(viewport);
        }
    }
    onPointerSchemeChanged() {
        const touchMode = isCoarsePointerDevice();
        if (touchMode === this.touchMode)
            return;
        this.touchMode = touchMode;
        for (const viewport of this._registeredViewports) {
            this.teardownViewport(viewport);
            this.setupViewport(viewport);
        }
    }
    setupViewport(viewport) {
        const camera = this.modelViewer.camera;
        if (!camera)
            return;
        const orbitControls = new OrbitControls(camera);
        orbitControls.connect(viewport);
        orbitControls.enableDamping = true;
        orbitControls.dampingFactor = 0.08;
        orbitControls.screenSpacePanning = true;
        orbitControls.addEventListener('change', () => {
            this.modelViewer.dispatch('three-applet-needs-render', undefined, true);
        });
        let thumbsticks = null;
        if (this.touchMode) {
            orbitControls.enabled = false;
            thumbsticks = new VirtualThumbsticks();
            thumbsticks.mount(viewport);
        }
        else {
            orbitControls.enabled = true;
        }
        this._viewportState.set(viewport, { orbitControls, thumbsticks });
        this.syncOrbitTarget(viewport);
        this.startAnimationLoop();
    }
    teardownViewport(viewport) {
        const state = this._viewportState.get(viewport);
        if (!state)
            return;
        state.thumbsticks?.unmount();
        state.orbitControls.dispose();
        this._viewportState.delete(viewport);
    }
    syncOrbitTarget(viewport) {
        const state = this._viewportState.get(viewport);
        const camera = this.modelViewer.camera;
        const modelRoot = this.modelViewer.modelRoot;
        if (!state || !camera || !modelRoot?.children.length)
            return;
        const target = computeOrbitTargetFromCameraAndModel(camera, modelRoot, new Vector3());
        state.orbitControls.target.copy(target);
        state.orbitControls.update();
        this.modelViewer.dispatch('three-applet-needs-render', undefined, true);
    }
    startAnimationLoop() {
        if (this._rafId)
            return;
        const tick = (time) => {
            this._rafId = requestAnimationFrame(tick);
            const dt = this._lastFrameTime ? (time - this._lastFrameTime) / 1000 : 0;
            this._lastFrameTime = time;
            let needsRender = false;
            for (const viewport of this._registeredViewports) {
                const state = this._viewportState.get(viewport);
                if (!state)
                    continue;
                if (this.touchMode) {
                    if (dt > 0 && this.applyMobileControls(viewport, dt))
                        needsRender = true;
                }
                else if (state.orbitControls.update()) {
                    needsRender = true;
                }
            }
            if (needsRender) {
                this.modelViewer.dispatch('three-applet-needs-render', undefined, true);
            }
        };
        this._lastFrameTime = 0;
        this._rafId = requestAnimationFrame(tick);
    }
    _lastFrameTime = 0;
    stopAnimationLoop() {
        if (!this._rafId)
            return;
        cancelAnimationFrame(this._rafId);
        this._rafId = 0;
        this._lastFrameTime = 0;
    }
    applyMobileControls(viewport, dt) {
        const state = this._viewportState.get(viewport);
        if (!state?.thumbsticks)
            return false;
        const camera = this.modelViewer.camera;
        if (!camera)
            return false;
        const target = state.orbitControls.target;
        const { leftStick, rightStick } = state.thumbsticks;
        const orbitX = bellStickCurve(leftStick.x);
        const orbitY = bellStickCurve(leftStick.y);
        const panX = bellStickCurve(rightStick.x);
        const panY = bellStickCurve(rightStick.y);
        if (orbitX === 0 && orbitY === 0 && panX === 0 && panY === 0)
            return false;
        _offset.subVectors(camera.position, target);
        _spherical.setFromVector3(_offset);
        _spherical.theta -= orbitX * ORBIT_SPEED * dt;
        _spherical.phi -= orbitY * ORBIT_SPEED * dt;
        _spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, _spherical.phi));
        _offset.setFromSpherical(_spherical);
        camera.position.copy(target).add(_offset);
        camera.lookAt(target);
        _right.set(1, 0, 0).applyQuaternion(camera.quaternion);
        _up.set(0, 1, 0).applyQuaternion(camera.quaternion);
        const panScale = _offset.length() * PAN_SPEED * dt;
        _panDelta
            .copy(_right)
            .multiplyScalar(-panX * panScale)
            .addScaledVector(_up, panY * panScale);
        target.add(_panDelta);
        camera.position.add(_panDelta);
        return true;
    }
};
__decorate([
    Property({ type: Boolean, value: isCoarsePointerDevice() })
], ModelViewerCameraTool.prototype, "touchMode", void 0);
ModelViewerCameraTool = __decorate([
    Register
], ModelViewerCameraTool);
export { ModelViewerCameraTool };
export function modelViewerCameraTool(props) {
    return new ModelViewerCameraTool(props);
}
