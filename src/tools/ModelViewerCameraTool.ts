import { Property, Register, WithBinding } from '@io-gui/core'
import { IoThreeViewport, ToolBase, ToolBaseProps } from '@io-gui/three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Vector3 } from 'three/webgpu'
import { ModelViewer } from '../applets/ModelViewer.js'
import { VirtualThumbsticks } from '../controls/VirtualThumbsticks.js'
import {
  computeOrbitTargetFromCameraAndModel,
  placeTargetOnCameraViewRay,
} from '../utils/presentationCameraRay.js'
import { applyStickCurve, StickVector } from '../utils/stickCurve.js'

export type ControlMode = 'FPS' | 'orbit'

const LOOK_SPEED = 1.6 / 5
const MOVE_SPEED = 1.2
const PITCH_LIMIT = Math.PI / 2 - 0.05
/** Radians per CSS pixel of mouse drag (left-stick equivalent). */
const MOUSE_LOOK_SENSITIVITY = 0.005 / 5

/** Peak look response after the half-sphere curve (left stick / mouse). */
const LEFT_STICK_MAX_MAGNITUDE = 1
/** Peak locomotion response after the half-sphere curve (right stick / WASD). */
const RIGHT_STICK_MAX_MAGNITUDE = 0.4

const _forward = new Vector3()
const _right = new Vector3()
const _lookAt = new Vector3()
const _moveDelta = new Vector3()
const _worldUp = new Vector3(0, 1, 0)

type ViewportCameraState = {
  /** Shared pivot: FPS focus distance / orbit target. */
  focus: Vector3
  orbitControls: OrbitControls
  thumbsticks: VirtualThumbsticks | null
  dragPointerId: number | null
  desktopPointersAttached: boolean
}

type KeyMoveState = {
  w: boolean
  a: boolean
  s: boolean
  d: boolean
}

function isCoarsePointerDevice() {
  return window.matchMedia('(pointer: coarse)').matches
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export type ModelViewerCameraToolProps = ToolBaseProps & {
  mode?: WithBinding<string>
  chromeIdle?: WithBinding<boolean>
  touchMode?: WithBinding<boolean>
}

@Register
export class ModelViewerCameraTool extends ToolBase {

  @Property({ type: Boolean, value: isCoarsePointerDevice() })
  declare touchMode: boolean

  @Property({ value: 'orbit', type: String })
  declare mode: ControlMode

  /** Shared page chrome idle flag: hides FPS thumbsticks after inactivity. */
  @Property({ value: false, type: Boolean })
  declare chromeIdle: boolean

  declare private _registeredViewports: IoThreeViewport[]
  declare private _viewportState
  declare private _keys: KeyMoveState
  declare private _rafId: number
  declare private _lastFrameTime: number

  private readonly _onModelReady = () => this.syncAllViewports()
  private readonly _onPresentation = () => this.pinAllViewportsToPresentationRay()
  private readonly _onPointerSchemeChanged = () => this.onPointerSchemeChanged()
  private readonly _onKeyDown = (event: KeyboardEvent) => this.onKeyChange(event, true)
  private readonly _onKeyUp = (event: KeyboardEvent) => this.onKeyChange(event, false)
  private readonly _onWindowBlur = () => this.clearKeys()

  init() {
    this._registeredViewports = []
    this._viewportState = new WeakMap<IoThreeViewport, ViewportCameraState>()
    this._keys = { w: false, a: false, s: false, d: false }
    this._rafId = 0
    this._lastFrameTime = 0
  }

  constructor(args?: ModelViewerCameraToolProps) {
    super(args)
    window.matchMedia('(pointer: coarse)').addEventListener('change', this._onPointerSchemeChanged)
    this.applet?.addEventListener('model-viewer-ready', this._onModelReady)
    this.applet?.addEventListener('model-viewer-presentation', this._onPresentation)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onWindowBlur)
  }

  get modelViewer(): ModelViewer {
    return this.applet as ModelViewer
  }

  modeChanged() {
    this.clearKeys()
    for (const viewport of this._registeredViewports) {
      this.syncMode(viewport)
    }
  }

  chromeIdleChanged() {
    this.syncThumbstickVisibility()
  }

  override registerViewport(viewport: IoThreeViewport) {
    if (this._registeredViewports.includes(viewport)) return
    this._registeredViewports.push(viewport)
    this.setupViewport(viewport)
  }

  override unregisterViewport(viewport: IoThreeViewport) {
    const index = this._registeredViewports.indexOf(viewport)
    if (index === -1) return
    this._registeredViewports.splice(index, 1)
    this.teardownViewport(viewport)
    if (!this._registeredViewports.length) this.stopAnimationLoop()
  }

  override dispose() {
    window.matchMedia('(pointer: coarse)').removeEventListener('change', this._onPointerSchemeChanged)
    this.applet?.removeEventListener('model-viewer-ready', this._onModelReady)
    this.applet?.removeEventListener('model-viewer-presentation', this._onPresentation)
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    window.removeEventListener('blur', this._onWindowBlur)
    this.clearKeys()
    for (const viewport of [...this._registeredViewports]) {
      this.unregisterViewport(viewport)
    }
    this.stopAnimationLoop()
    super.dispose()
  }

  syncAllViewports() {
    for (const viewport of this._registeredViewports) {
      this.syncFocus(viewport)
    }
  }

  /** After presentation pose is applied, keep orbit target on the view ray so lookAt is a no-op. */
  private pinAllViewportsToPresentationRay() {
    for (const viewport of this._registeredViewports) {
      this.pinFocusToPresentationRay(viewport)
    }
  }

  private hasModel() {
    return !!this.modelViewer.modelRoot?.children.length
  }

  private onPointerSchemeChanged() {
    const touchMode = isCoarsePointerDevice()
    if (touchMode === this.touchMode) return
    this.touchMode = touchMode
    this.clearKeys()
    // Keep OrbitControls alive — disposing it on scheme change hits a Three.js
    // getRootNode()/keydown cleanup mismatch against io-gui's EventDispatcher.
    for (const viewport of this._registeredViewports) {
      this.syncPointerScheme(viewport)
    }
  }

  private setupViewport(viewport: IoThreeViewport) {
    const camera = this.modelViewer.camera
    if (!camera) return

    const orbitControls = new OrbitControls(camera)
    orbitControls.connect(viewport)
    orbitControls.enableDamping = true
    orbitControls.dampingFactor = 0.08
    orbitControls.screenSpacePanning = true
    orbitControls.addEventListener('change', () => {
      const state = this._viewportState.get(viewport)
      if (state) state.focus.copy(orbitControls.target)
      this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
    })

    this._viewportState.set(viewport, {
      focus: new Vector3(),
      orbitControls,
      thumbsticks: null,
      dragPointerId: null,
      desktopPointersAttached: false,
    })
    this.syncPointerScheme(viewport)
    this.syncFocus(viewport)
    this.syncMode(viewport)
    this.startAnimationLoop()
  }

  /** Swap thumbsticks vs desktop FPS pointers without recreating OrbitControls. */
  private syncPointerScheme(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    if (!state) return

    this.detachDesktopPointers(viewport, state)
    state.thumbsticks?.unmount()
    state.thumbsticks = null
    state.dragPointerId = null

    if (this.touchMode) {
      state.thumbsticks = new VirtualThumbsticks()
      state.thumbsticks.mount(viewport)
    } else {
      this.attachDesktopPointers(viewport, state)
    }

    this.syncThumbstickVisibility()
  }

  private attachDesktopPointers(viewport: IoThreeViewport, state: ViewportCameraState) {
    if (state.desktopPointersAttached) return
    viewport.addEventListener('pointerdown', this._onDesktopPointerDown)
    viewport.addEventListener('pointermove', this._onDesktopPointerMove)
    viewport.addEventListener('pointerup', this._onDesktopPointerUp)
    viewport.addEventListener('pointercancel', this._onDesktopPointerUp)
    viewport.addEventListener('lostpointercapture', this._onDesktopPointerUp)
    state.desktopPointersAttached = true
  }

  private detachDesktopPointers(viewport: IoThreeViewport, state: ViewportCameraState) {
    if (!state.desktopPointersAttached) return
    viewport.removeEventListener('pointerdown', this._onDesktopPointerDown)
    viewport.removeEventListener('pointermove', this._onDesktopPointerMove)
    viewport.removeEventListener('pointerup', this._onDesktopPointerUp)
    viewport.removeEventListener('pointercancel', this._onDesktopPointerUp)
    viewport.removeEventListener('lostpointercapture', this._onDesktopPointerUp)
    state.desktopPointersAttached = false
  }

  private teardownViewport(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    if (!state) return
    state.thumbsticks?.unmount()
    this.detachDesktopPointers(viewport, state)
    // Disconnect while still attached when possible so OrbitControls removes its
    // document keydown interceptor from the same root it registered on.
    state.orbitControls.dispose()
    this._viewportState.delete(viewport)
  }

  private syncMode(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    if (!state) return

    // OrbitControls owns both desktop and touch when orbit mode is selected.
    state.orbitControls.enabled = this.mode === 'orbit'
    state.dragPointerId = null

    if (this.mode === 'orbit') {
      state.orbitControls.target.copy(state.focus)
      // update() lookAt() would overwrite presentation while the model/focus are not ready.
      if (this.hasModel()) state.orbitControls.update()
    } else {
      state.focus.copy(state.orbitControls.target)
    }

    this.syncThumbstickVisibility()
    this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
  }

  /** Sticks only in FPS touch mode; always hidden while orbiting or chrome-idle. */
  private syncThumbstickVisibility() {
    const show = this.mode === 'FPS' && this.touchMode && !this.chromeIdle
    for (const viewport of this._registeredViewports) {
      const state = this._viewportState.get(viewport)
      state?.thumbsticks?.setVisible(show)
    }
  }

  /**
   * Recompute FPS/orbit pivot from the current presentation camera + model bounds.
   * Intentionally does not reorient the camera — presentation pose must stay as loaded.
   * OrbitControls.update() is deferred to the next orbit frame; target stays on the view ray
   * so that lookAt preserves orientation.
   */
  private syncFocus(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    const modelRoot = this.modelViewer.modelRoot
    if (!state || !camera || !modelRoot?.children.length) return

    computeOrbitTargetFromCameraAndModel(camera, modelRoot, state.focus)
    state.orbitControls.target.copy(state.focus)
    this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
  }

  /** Pin pivot to the current view ray (used right after presentation camera is applied). */
  private pinFocusToPresentationRay(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    if (!state || !camera) return

    const distance = Math.max(camera.position.distanceTo(state.focus), 1)
    placeTargetOnCameraViewRay(camera, state.focus, distance)
    state.orbitControls.target.copy(state.focus)
    this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
  }

  private startAnimationLoop() {
    if (this._rafId) return
    const tick = (time: number) => {
      this._rafId = requestAnimationFrame(tick)
      // Proactive page cache keeps the tool alive off-DOM; skip work until visible again.
      if (!this._registeredViewports.some((viewport) => viewport.isConnected)) return

      const dt = this._lastFrameTime ? (time - this._lastFrameTime) / 1000 : 0
      this._lastFrameTime = time

      let needsRender = false
      for (const viewport of this._registeredViewports) {
        if (dt > 0 && this.applyFrameControls(viewport, dt)) needsRender = true
      }
      if (needsRender) {
        this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
      }
    }
    this._lastFrameTime = 0
    this._rafId = requestAnimationFrame(tick)
  }

  private stopAnimationLoop() {
    if (!this._rafId) return
    cancelAnimationFrame(this._rafId)
    this._rafId = 0
    this._lastFrameTime = 0
  }

  /** Shared per-frame path for the active control mode. */
  private applyFrameControls(viewport: IoThreeViewport, dt: number) {
    const state = this._viewportState.get(viewport)
    if (!state) return false

    if (this.mode === 'orbit') {
      // During asset load, presentation may already be applied while focus is still stale.
      // Skip lookAt until the model exists and syncFocus has placed the target on the view ray.
      if (!this.hasModel()) return false
      return state.orbitControls.update()
    }

    return this.applyFpsControls(viewport, dt)
  }

  /** FPS: sticks on touch, WASD on desktop (mouse look is event-driven). */
  private applyFpsControls(viewport: IoThreeViewport, dt: number) {
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    if (!state || !camera) return false

    let look: StickVector = { x: 0, y: 0 }
    let move: StickVector = { x: 0, y: 0 }

    if (this.touchMode && state.thumbsticks) {
      look = applyStickCurve(state.thumbsticks.leftStick, {
        maxMagnitude: LEFT_STICK_MAX_MAGNITUDE,
      })
      move = applyStickCurve(state.thumbsticks.rightStick, {
        maxMagnitude: RIGHT_STICK_MAX_MAGNITUDE,
      })
    } else if (!this.touchMode) {
      move = applyStickCurve(
        {
          x: (this._keys.d ? 1 : 0) - (this._keys.a ? 1 : 0),
          y: (this._keys.w ? 1 : 0) - (this._keys.s ? 1 : 0),
        },
        {
          maxMagnitude: RIGHT_STICK_MAX_MAGNITUDE,
        },
      )
    }

    let changed = false
    if (look.x !== 0 || look.y !== 0) {
      this.applyLook(camera, state.focus, look.x * LOOK_SPEED * dt, -look.y * LOOK_SPEED * dt)
      changed = true
    }
    if (move.x !== 0 || move.y !== 0) {
      this.applyMove(camera, state.focus, move.x, move.y, dt)
      changed = true
    }
    return changed
  }

  private onKeyChange(event: KeyboardEvent, isDown: boolean) {
    if (this.mode !== 'FPS' || this.touchMode || event.metaKey || event.ctrlKey || event.altKey) return
    if (isTypingTarget(event.target)) return

    const key = event.key.toLowerCase()
    if (key !== 'w' && key !== 'a' && key !== 's' && key !== 'd') return

    event.preventDefault()
    this._keys[key] = isDown
  }

  private clearKeys() {
    this._keys.w = false
    this._keys.a = false
    this._keys.s = false
    this._keys.d = false
  }

  private _onDesktopPointerDown = (event: PointerEvent) => {
    if (this.mode !== 'FPS' || this.touchMode || event.button !== 0) return
    const viewport = event.currentTarget as IoThreeViewport
    const state = this._viewportState.get(viewport)
    if (!state) return
    state.dragPointerId = event.pointerId
    viewport.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  private _onDesktopPointerMove = (event: PointerEvent) => {
    if (this.mode !== 'FPS' || this.touchMode) return
    const viewport = event.currentTarget as IoThreeViewport
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    if (!state || !camera || state.dragPointerId !== event.pointerId) return

    const yaw = event.movementX * MOUSE_LOOK_SENSITIVITY
    const pitch = -event.movementY * MOUSE_LOOK_SENSITIVITY
    if (yaw === 0 && pitch === 0) return

    this.applyLook(camera, state.focus, yaw, pitch)
    this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
    event.preventDefault()
  }

  private _onDesktopPointerUp = (event: PointerEvent) => {
    const viewport = event.currentTarget as IoThreeViewport
    const state = this._viewportState.get(viewport)
    if (!state || state.dragPointerId !== event.pointerId) return
    state.dragPointerId = null
    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId)
    }
  }

  /**
   * Left stick / mouse drag: upright head look at fixed eye position.
   * Keeps `focus` on the view ray at the previous distance for move scaling.
   */
  private applyLook(
    camera: ModelViewer['camera'],
    focus: Vector3,
    yawAmount: number,
    pitchAmount: number,
  ) {
    camera.getWorldDirection(_forward)

    _forward.applyAxisAngle(_worldUp, -yawAmount)

    _right.crossVectors(_forward, _worldUp)
    if (_right.lengthSq() < 1e-10) {
      _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
      _right.y = 0
      if (_right.lengthSq() < 1e-10) _right.set(1, 0, 0)
    }
    _right.normalize()

    const currentPitch = Math.asin(Math.max(-1, Math.min(1, _forward.dot(_worldUp))))
    const nextPitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, currentPitch + pitchAmount))
    _forward.applyAxisAngle(_right, nextPitch - currentPitch)
    _forward.normalize()

    camera.up.copy(_worldUp)
    _lookAt.copy(camera.position).add(_forward)
    camera.lookAt(_lookAt)

    const distance = Math.max(camera.position.distanceTo(focus), 0.01)
    focus.copy(camera.position).addScaledVector(_forward, distance)
  }

  /**
   * Right stick / WASD: locomotion along view and camera-right.
   * Camera and focus translate in parallel.
   */
  private applyMove(
    camera: ModelViewer['camera'],
    focus: Vector3,
    moveX: number,
    moveY: number,
    dt: number,
  ) {
    camera.getWorldDirection(_forward)
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    const moveScale = Math.max(camera.position.distanceTo(focus), 0.5) * MOVE_SPEED * dt
    _moveDelta
      .copy(_right)
      .multiplyScalar(moveX * moveScale)
      .addScaledVector(_forward, moveY * moveScale)
    focus.add(_moveDelta)
    camera.position.add(_moveDelta)
  }
}