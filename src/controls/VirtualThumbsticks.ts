export type StickVector = Readonly<{ x: number; y: number }>

const ZERO: StickVector = { x: 0, y: 0 }

type ActivePointer = {
  pointerId: number
  centerX: number
  centerY: number
}

/**
 * Screen-space twin thumbsticks as an HTML overlay on the viewport.
 *
 * Prefer HTML over Three.js scene objects: sticks must stay fixed in screen
 * space, ignore camera/fog/lighting, and use reliable pointer capture for touch.
 */
export class VirtualThumbsticks {
  readonly element: HTMLDivElement

  private readonly _leftKnob: HTMLDivElement
  private readonly _rightKnob: HTMLDivElement
  private readonly _leftZone: HTMLDivElement
  private readonly _rightZone: HTMLDivElement

  private _left: StickVector = ZERO
  private _right: StickVector = ZERO
  private _leftActive: ActivePointer | null = null
  private _rightActive: ActivePointer | null = null
  private _mounted = false

  constructor() {
    this.element = document.createElement('div')
    this.element.className = 'model-viewer-thumbsticks'

    this._leftZone = this.createZone('left')
    this._rightZone = this.createZone('right')
    this._leftKnob = this.createKnob()
    this._rightKnob = this.createKnob()

    this._leftZone.appendChild(this._leftKnob)
    this._rightZone.appendChild(this._rightKnob)
    this.element.append(this._leftZone, this._rightZone)

    this.applyStyles()
    this.bindEvents()
  }

  get leftStick(): StickVector {
    return this._left
  }

  get rightStick(): StickVector {
    return this._right
  }

  mount(parent: HTMLElement) {
    if (this._mounted) return
    parent.appendChild(this.element)
    this._mounted = true
  }

  unmount() {
    if (!this._mounted) return
    this.element.remove()
    this._mounted = false
    this.reset()
  }

  reset() {
    this._left = ZERO
    this._right = ZERO
    this._leftActive = null
    this._rightActive = null
    this._leftKnob.style.transform = 'translate(-50%, -50%)'
    this._rightKnob.style.transform = 'translate(-50%, -50%)'
  }

  private createZone(side: 'left' | 'right') {
    const zone = document.createElement('div')
    zone.className = `stick-zone stick-zone-${side}`
    zone.dataset.side = side
    return zone
  }

  private createKnob() {
    const knob = document.createElement('div')
    knob.className = 'stick-knob'
    return knob
  }

  private applyStyles() {
    const style = document.createElement('style')
    style.textContent = /* css */`
      .model-viewer-thumbsticks {
        position: absolute;
        inset: 0;
        pointer-events: none;
        z-index: 2;
        touch-action: none;
      }
      .model-viewer-thumbsticks .stick-zone {
        position: absolute;
        /* Sit above the collapsed drawer peek (handle + revealed info). */
        bottom: calc(var(--io_drawerHandleSize, 40px) + var(--io_revealOffset, 0px) + 28px);
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--io_bgColorStrong, #222) 35%, transparent);
        border: 1px solid color-mix(in srgb, var(--io_colorWhite, #fff) 20%, transparent);
        pointer-events: auto;
        touch-action: none;
      }
      .model-viewer-thumbsticks .stick-zone-left {
        left: 24px;
      }
      .model-viewer-thumbsticks .stick-zone-right {
        right: 24px;
      }
      .model-viewer-thumbsticks .stick-knob {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: color-mix(in srgb, var(--io_colorWhite, #fff) 55%, transparent);
        transform: translate(-50%, -50%);
        pointer-events: none;
      }
    `
    this.element.appendChild(style)
  }

  private bindEvents() {
    for (const zone of [this._leftZone, this._rightZone]) {
      zone.addEventListener('pointerdown', this.onPointerDown)
      zone.addEventListener('pointermove', this.onPointerMove)
      zone.addEventListener('pointerup', this.onPointerUp)
      zone.addEventListener('pointercancel', this.onPointerUp)
      zone.addEventListener('lostpointercapture', this.onPointerUp)
    }
  }

  private onPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const zone = event.currentTarget as HTMLDivElement
    const side = zone.dataset.side as 'left' | 'right'
    const rect = zone.getBoundingClientRect()
    const active: ActivePointer = {
      pointerId: event.pointerId,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    }
    zone.setPointerCapture(event.pointerId)
    if (side === 'left') this._leftActive = active
    else this._rightActive = active
    this.updateStick(side, event.clientX, event.clientY, active)
  }

  private onPointerMove = (event: PointerEvent) => {
    const zone = event.currentTarget as HTMLDivElement
    const side = zone.dataset.side as 'left' | 'right'
    const active = side === 'left' ? this._leftActive : this._rightActive
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    this.updateStick(side, event.clientX, event.clientY, active)
  }

  private onPointerUp = (event: PointerEvent) => {
    const zone = event.currentTarget as HTMLDivElement
    const side = zone.dataset.side as 'left' | 'right'
    const active = side === 'left' ? this._leftActive : this._rightActive
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault()
    event.stopPropagation()
    zone.releasePointerCapture(event.pointerId)
    if (side === 'left') {
      this._leftActive = null
      this._left = ZERO
      this._leftKnob.style.transform = 'translate(-50%, -50%)'
    } else {
      this._rightActive = null
      this._right = ZERO
      this._rightKnob.style.transform = 'translate(-50%, -50%)'
    }
  }

  private updateStick(
    side: 'left' | 'right',
    clientX: number,
    clientY: number,
    active: ActivePointer,
  ) {
    const radius = 38
    let dx = clientX - active.centerX
    let dy = clientY - active.centerY
    const len = Math.hypot(dx, dy)
    if (len > radius) {
      dx = (dx / len) * radius
      dy = (dy / len) * radius
    }
    const x = dx / radius
    const y = -(dy / radius)
    const knob = side === 'left' ? this._leftKnob : this._rightKnob
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    if (side === 'left') this._left = { x, y }
    else this._right = { x, y }
  }
}
