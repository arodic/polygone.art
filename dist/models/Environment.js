var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Property, ReactiveObject, Register, Field } from '@io-gui/core';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EquirectangularReflectionMapping, PMREMGenerator, Texture, } from 'three/webgpu';
const hdrLoader = new HDRLoader();
let Environment = class Environment extends ReactiveObject {
    _pmremGenerator = null;
    constructor(args) {
        super(args);
    }
    pathChanged() {
        hdrLoader.manager.abort();
        const generation = ++this._loadGeneration;
        const path = this.path;
        hdrLoader.load(path, rawTexture => {
            if (generation !== this._loadGeneration) {
                rawTexture.dispose();
                return;
            }
            rawTexture.mapping = EquirectangularReflectionMapping;
            this.rawTexture?.dispose();
            this.rawTexture = rawTexture;
            this.generateTextureFromRawTexture();
        }, undefined, err => {
            if (generation !== this._loadGeneration)
                return;
            console.error('Polygone HDR failed', path, err);
        });
    }
    generateTextureFromRawTexture() {
        if (this._pmremGenerator === null)
            return;
        if (this.rawTexture === undefined)
            return;
        const rt = this._pmremGenerator.fromEquirectangular(this.rawTexture);
        this.texture = rt.texture;
    }
    initPMREMGeneratorWithRenderer(renderer) {
        if (this._pmremGenerator !== null)
            return;
        this._pmremGenerator = new PMREMGenerator(renderer);
        this.generateTextureFromRawTexture();
    }
};
__decorate([
    Property({ type: String, init: null })
], Environment.prototype, "path", void 0);
__decorate([
    Property({ type: Texture })
], Environment.prototype, "rawTexture", void 0);
__decorate([
    Property({ type: Texture, init: null })
], Environment.prototype, "texture", void 0);
__decorate([
    Field(0)
], Environment.prototype, "_loadGeneration", void 0);
Environment = __decorate([
    Register
], Environment);
export { Environment };
