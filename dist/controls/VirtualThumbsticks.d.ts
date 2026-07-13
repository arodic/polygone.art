export type StickVector = Readonly<{
    x: number;
    y: number;
}>;
/**
 * Screen-space twin thumbsticks. HTML overlay — fixed to the viewport, not the 3D scene,
 * so they stay readable and don't participate in rendering or camera transforms.
 */
export declare class VirtualThumbsticks {
    readonly element: HTMLDivElement;
    private readonly _leftKnob;
    private readonly _rightKnob;
    private readonly _leftZone;
    private readonly _rightZone;
    private _left;
    private _right;
    private _leftActive;
    private _rightActive;
    private _mounted;
    constructor();
    get leftStick(): StickVector;
    get rightStick(): StickVector;
    mount(parent: HTMLElement): void;
    unmount(): void;
    reset(): void;
    private createZone;
    private createKnob;
    private applyStyles;
    private bindEvents;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private updateStick;
}
