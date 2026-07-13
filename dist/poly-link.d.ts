import { ReactiveElement, ReactiveElementProps } from '@io-gui/core';
type PolyLinkProps = ReactiveElementProps & {
    value: string;
    label: string;
};
export declare class PolyLink extends ReactiveElement {
    static get Style(): string;
    value: string;
    label: string;
    static get Listeners(): {
        click: string;
    };
    constructor(props: PolyLinkProps);
    labelChanged(): void;
    onClicked(): void;
}
export declare const polyLink: (props: PolyLinkProps) => import("@io-gui/core").VDOMElement;
export {};
