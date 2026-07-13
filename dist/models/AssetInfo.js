var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, ReactiveObject, Register } from '@io-gui/core';
import { BLOB_URL } from '../constants';
const ASSET_INFO_CACHE = new Map();
let AssetInfo = class AssetInfo extends ReactiveObject {
    guidChanged() {
        this.clear();
        if (this.guid) {
            this.load(this.guid).catch((error) => {
                console.error(error);
            });
        }
    }
    clear() {
        this.setProperties({
            name: '',
            description: '',
            authorId: '',
            authorName: '',
            createTime: '',
            updateTime: '',
            license: 'UNKNOWN',
            visibility: 'UNKNOWN',
            tags: [],
            likes: 0,
            formats: [],
            presentationParams: {
                backgroundColor: '#000000',
                colorSpace: 'UNKNOWN',
                orientingRotation: {
                    x: 0,
                    y: 0,
                    z: 0,
                    w: 1,
                },
            },
        }, true);
    }
    load(guid) {
        if (ASSET_INFO_CACHE.has(guid)) {
            this.applyJSON(ASSET_INFO_CACHE.get(guid));
            return Promise.resolve(this);
        }
        else {
            return new Promise((resolve, reject) => {
                fetch(`${BLOB_URL}/assets/${guid}/data.json`).then(async (response) => {
                    const assetInfoData = await response.json();
                    console.log(assetInfoData);
                    this.applyJSON(assetInfoData);
                    ASSET_INFO_CACHE.set(guid, assetInfoData);
                    resolve(this);
                }).catch(reject);
            });
        }
    }
    applyJSON(assetInfoData) {
        this.setProperties({
            name: assetInfoData.name,
            description: assetInfoData.description || '',
            authorId: assetInfoData.authorId,
            authorName: assetInfoData.authorName,
            createTime: assetInfoData.createTime,
            updateTime: assetInfoData.updateTime,
            license: assetInfoData.license,
            visibility: assetInfoData.visibility,
            tags: assetInfoData.tags,
            likes: assetInfoData.likes,
            formats: assetInfoData.formats,
            presentationParams: assetInfoData.presentationParams
        });
        return this;
    }
};
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "guid", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "name", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "description", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "authorId", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "authorName", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "createTime", void 0);
__decorate([
    Property({ type: String, init: '' })
], AssetInfo.prototype, "updateTime", void 0);
__decorate([
    Property({ type: String, init: 'UNKNOWN' })
], AssetInfo.prototype, "license", void 0);
__decorate([
    Property({ type: String, init: 'UNKNOWN' })
], AssetInfo.prototype, "visibility", void 0);
__decorate([
    Property({ type: Array, init: null })
], AssetInfo.prototype, "tags", void 0);
__decorate([
    Property(0)
], AssetInfo.prototype, "likes", void 0);
__decorate([
    Property({ type: Array, init: null })
], AssetInfo.prototype, "formats", void 0);
__decorate([
    Property({ type: Object, init: null })
], AssetInfo.prototype, "presentationParams", void 0);
AssetInfo = __decorate([
    Register
], AssetInfo);
export { AssetInfo };
