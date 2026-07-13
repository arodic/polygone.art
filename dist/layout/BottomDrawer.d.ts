import { ReactiveObject } from '@io-gui/core';
export type BottomDrawerData = {
    drawerSize?: string;
};
export declare class BottomDrawer extends ReactiveObject {
    drawerSize: string;
    constructor(data?: BottomDrawerData);
}
