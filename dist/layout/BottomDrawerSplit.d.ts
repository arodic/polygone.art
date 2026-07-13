import { ReactiveElement, ReactiveElementProps, VDOMElement, WithBinding } from '@io-gui/core';
import { BottomDrawer } from './BottomDrawer.js';
export type BottomDrawerSplitProps = ReactiveElementProps & {
    model: WithBinding<BottomDrawer>;
    elements: VDOMElement[];
    revealSelector?: string;
};
export declare class BottomDrawerSplit extends ReactiveElement {
    #private;
    static get Style(): string;
    model: BottomDrawer;
    elements: VDOMElement[];
    expanded: boolean;
    intro: boolean;
    revealSelector: string;
    static get Listeners(): {
        'io-drawer-toggle': string;
    };
    connectedCallback(): void;
    onResized(): void;
    updateDrawerSize(): void;
    updateRevealOffset(): void;
    observeRevealTarget(): void;
    revealSelectorChanged(): void;
    onToggleExpanded(event: MouseEvent): void;
    onVeilClick(event: MouseEvent): void;
    expandedChanged(): void;
    modelMutated(): void;
    mutated(): void;
    observeRevealTargetDebounced(): void;
    disconnectedCallback(): void;
}
export declare const bottomDrawerSplit: (props: BottomDrawerSplitProps) => VDOMElement;
