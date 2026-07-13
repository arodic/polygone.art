import { Property, Register } from '@io-gui/core'
import { IoThreeViewport, ToolBase, ToolBaseProps } from '@io-gui/three'
import { Vector3 } from 'three/webgpu'
import { ModelViewer } from '../applets/ModelViewer.js'
import { VirtualThumbsticks } from '../controls/VirtualThumbsticks.js'
import { computeOrbitTargetFromCameraAndModel } from '../utils/presentationCameraRay.js'
import { applyStickCurve, StickVector } from '../utils/stickCurve.js'

const LOOK_SPEED = 1.6 / 3
const MOVE_SPEED = 1.2
const PITCH_LIMIT = Math.PI / 2 - 0.05
/** Radians per CSS pixel of mouse drag (left-stick equivalent). */
const MOUSE_LOOK_SENSITIVITY = 0.005 / 3

/** Peak look response after the inverted-bell curve (left stick / mouse). */
const LEFT_STICK_MAX_MAGNITUDE = 1
/** Peak locomotion response after the inverted-bell curve (right stick / WASD). */
const RIGHT_STICK_MAX_MAGNITUDE = 1
/** Shared precision-basin width; smaller = more fine control near center. */
const STICK_CURVE_SIGMA = 0.35

const _forward = new Vector3()
const _right = new Vector3()
const _lookAt = new Vector3()
const _moveDelta = new Vector3()
const _worldUp = new Vector3(0, 1, 0)

type ViewportCameraState = {
  /** Point along the view ray used for locomotion distance scaling. */
  focus: Vector3
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

@Register
export class ModelViewerCameraTool extends ToolBase {

  @Property({ type: Boolean, value: isCoarsePointerDevice() })
  declare touchMode: boolean

  private readonly _registeredViewports: IoThreeViewport[] = []
  private readonly _viewportState = new WeakMap<IoThreeViewport, ViewportCameraState>()
  private readonly _keys: KeyMoveState = { w: false, a: false, s: false, d: false }
  private _rafId = 0
  private _lastFrameTime = 0

  private readonly _onModelReady = () => this.syncAllViewports()
  private readonly _onPointerSchemeChanged = () => this.onPointerSchemeChanged()
  private readonly _onKeyDown = (event: KeyboardEvent) => this.onKeyChange(event, true)
  private readonly _onKeyUp = (event: KeyboardEvent) => this.onKeyChange(event, false)
  private readonly _onWindowBlur = () => this.clearKeys()

  constructor(args?: ToolBaseProps) {
    super(args)
    window.matchMedia('(pointer: coarse)').addEventListener('change', this._onPointerSchemeChanged)
    this.applet?.addEventListener('model-viewer-ready', this._onModelReady)
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    window.addEventListener('blur', this._onWindowBlur)
  }

  get modelViewer(): ModelViewer {
    return this.applet as ModelViewer
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

  private onPointerSchemeChanged() {
    const touchMode = isCoarsePointerDevice()
    if (touchMode === this.touchMode) return
    this.touchMode = touchMode
    this.clearKeys()
    for (const viewport of this._registeredViewports) {
      this.teardownViewport(viewport)
      this.setupViewport(viewport)
    }
  }

  private setupViewport(viewport: IoThreeViewport) {
    const camera = this.modelViewer.camera
    if (!camera) return

    let thumbsticks: VirtualThumbsticks | null = null
    let desktopPointersAttached = false
    if (this.touchMode) {
      thumbsticks = new VirtualThumbsticks()
      thumbsticks.mount(viewport)
    } else {
      viewport.addEventListener('pointerdown', this._onDesktopPointerDown)
      viewport.addEventListener('pointermove', this._onDesktopPointerMove)
      viewport.addEventListener('pointerup', this._onDesktopPointerUp)
      viewport.addEventListener('pointercancel', this._onDesktopPointerUp)
      viewport.addEventListener('lostpointercapture', this._onDesktopPointerUp)
      desktopPointersAttached = true
    }

    this._viewportState.set(viewport, {
      focus: new Vector3(),
      thumbsticks,
      dragPointerId: null,
      desktopPointersAttached,
    })
    this.syncFocus(viewport)
    this.startAnimationLoop()
  }

  private teardownViewport(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    if (!state) return
    state.thumbsticks?.unmount()
    if (state.desktopPointersAttached) {
      viewport.removeEventListener('pointerdown', this._onDesktopPointerDown)
      viewport.removeEventListener('pointermove', this._onDesktopPointerMove)
      viewport.removeEventListener('pointerup', this._onDesktopPointerUp)
      viewport.removeEventListener('pointercancel', this._onDesktopPointerUp)
      viewport.removeEventListener('lostpointercapture', this._onDesktopPointerUp)
    }
    this._viewportState.delete(viewport)
  }

  private syncFocus(viewport: IoThreeViewport) {
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    const modelRoot = this.modelViewer.modelRoot
    if (!state || !camera || !modelRoot?.children.length) return

    computeOrbitTargetFromCameraAndModel(camera, modelRoot, state.focus)
    this.modelViewer.dispatch('three-applet-needs-render', undefined, true)
  }

  private startAnimationLoop() {
    if (this._rafId) return
    const tick = (time: number) => {
      this._rafId = requestAnimationFrame(tick)
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

  /** Shared per-frame path: sticks on touch, WASD on desktop (mouse look is event-driven). */
  private applyFrameControls(viewport: IoThreeViewport, dt: number) {
    const state = this._viewportState.get(viewport)
    const camera = this.modelViewer.camera
    if (!state || !camera) return false

    let look: StickVector = { x: 0, y: 0 }
    let move: StickVector = { x: 0, y: 0 }

    if (this.touchMode && state.thumbsticks) {
      look = applyStickCurve(state.thumbsticks.leftStick, {
        sigma: STICK_CURVE_SIGMA,
        maxMagnitude: LEFT_STICK_MAX_MAGNITUDE,
      })
      move = applyStickCurve(state.thumbsticks.rightStick, {
        sigma: STICK_CURVE_SIGMA,
        maxMagnitude: RIGHT_STICK_MAX_MAGNITUDE,
      })
    } else if (!this.touchMode) {
      move = applyStickCurve(
        {
          x: (this._keys.d ? 1 : 0) - (this._keys.a ? 1 : 0),
          y: (this._keys.w ? 1 : 0) - (this._keys.s ? 1 : 0),
        },
        {
          sigma: STICK_CURVE_SIGMA,
          maxMagnitude: RIGHT_STICK_MAX_MAGNITUDE,
        },
      )
    }

    let changed = false
    if (look.x !== 0 || look.y !== 0) {
      this.applyLook(camera, state.focus, look.x * LOOK_SPEED * dt, look.y * LOOK_SPEED * dt)
      changed = true
    }
    if (move.x !== 0 || move.y !== 0) {
      this.applyMove(camera, state.focus, move.x, move.y, dt)
      changed = true
    }
    return changed
  }

  private onKeyChange(event: KeyboardEvent, isDown: boolean) {
    if (this.touchMode || event.metaKey || event.ctrlKey || event.altKey) return
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
    if (this.touchMode || event.button !== 0) return
    const viewport = event.currentTarget as IoThreeViewport
    const state = this._viewportState.get(viewport)
    if (!state) return
    state.dragPointerId = event.pointerId
    viewport.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  private _onDesktopPointerMove = (event: PointerEvent) => {
    if (this.touchMode) return
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

export type ModelViewerCameraToolProps = ToolBaseProps

export function modelViewerCameraTool(props: ModelViewerCameraToolProps) {
  return new ModelViewerCameraTool(props)
}
