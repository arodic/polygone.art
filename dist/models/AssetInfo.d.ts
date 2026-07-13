import { ReactiveObject, WithBinding } from '@io-gui/core';
type License = 'UNKNOWN' | 'CREATIVE_COMMONS_BY' | 'ALL_RIGHTS_RESERVED';
type Visibility = 'VISIBILITY_UNSPECIFIED' | 'PRIVATE' | 'UNLISTED' | 'PUBLIC';
type FormatType = 'FBX' | 'GLTF' | 'GLTF2' | 'OBJ' | 'TILT' | 'GLB';
type ColorSpace = 'UNKNOWN' | 'LINEAR' | 'GAMMA';
type FileInfo = {
    relativePath: string;
    contentType: string;
    url?: string;
};
type FormatComplexity = {
    lodHint?: number;
    triangleCount?: string;
};
type Format = {
    formatType: FormatType;
    root: FileInfo;
    resources?: FileInfo[];
    formatComplexity?: FormatComplexity;
};
type Quaternion = {
    x?: number;
    y?: number;
    z?: number;
    w?: number;
};
type PresentationParams = {
    backgroundColor?: string;
    colorSpace?: ColorSpace;
    orientingRotation?: Quaternion;
};
export type AssetInfoData = {
    name: string;
    description?: string;
    authorId: string;
    authorName: string;
    createTime: string;
    updateTime: string;
    license: License;
    visibility: Visibility;
    tags: string[];
    likes: number;
    formats: Format[];
    presentationParams: PresentationParams;
};
export declare class AssetInfo extends ReactiveObject {
    guid: WithBinding<string>;
    name: string;
    description: string;
    authorId: string;
    authorName: string;
    createTime: string;
    updateTime: string;
    license: License;
    visibility: Visibility;
    tags: string[];
    likes: number;
    formats: Format[];
    presentationParams: PresentationParams;
    guidChanged(): void;
    clear(): void;
    load(guid: string): Promise<unknown>;
    applyJSON(assetInfoData: AssetInfoData): this;
}
export {};
