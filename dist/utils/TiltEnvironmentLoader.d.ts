import { AmbientLight, Color, FogExp2, Mesh, Object3D, Vector3 } from 'three';
/** Open Brush environment presets (lights from gallery-viewer / Open Brush assets). */
declare const ENVIRONMENT_MANIFEST: readonly [{
    readonly name: "Black";
    readonly guid: "580b4529-ac50-4fe9-b8d2-635765a14893";
    readonly file: "Black.glb";
    readonly lights: {
        readonly ambient: readonly [0.392156869, 0.392156869, 0.392156869];
        readonly light0: {
            readonly color: readonly [0.7780392, 0.815686345, 0.9913726];
            readonly rotation: readonly [60.0000038, 0, 25.9999962];
        };
        readonly light1: {
            readonly color: readonly [0.428235322, 0.4211765, 0.3458824];
            readonly rotation: readonly [40.0000038, 180, 220];
        };
    };
}, {
    readonly name: "Blue";
    readonly guid: "0ca88298-e5e8-4e94-aad8-4b4f6c80ae52";
    readonly file: "Blue.glb";
    readonly lights: {
        readonly ambient: readonly [0.203921571, 0.294117659, 0.368627459];
        readonly light0: {
            readonly color: readonly [1.5533334, 1.40666676, 1.77333343];
            readonly rotation: readonly [60.0000038, 0, 25.9999962];
        };
        readonly light1: {
            readonly color: readonly [0.271215677, 0.2667451, 0.219058827];
            readonly rotation: readonly [40.0000038, 180, 220];
        };
    };
}, {
    readonly name: "DressForm";
    readonly guid: "e2e72b76-d443-4721-97e6-f3d49fe98dda";
    readonly file: "DressForm.glb";
    readonly lights: {
        readonly ambient: readonly [0.4117647, 0.3529412, 0.596078455];
        readonly light0: {
            readonly color: readonly [1.1152941, 0.917647064, 0.7764706];
            readonly rotation: readonly [50, 41.9999962, 25.9999924];
        };
        readonly light1: {
            readonly color: readonly [0.356862754, 0.3509804, 0.2882353];
            readonly rotation: readonly [40.0000038, 227, 220];
        };
    };
}, {
    readonly name: "Illustrative";
    readonly guid: "e65cde1a-a177-4bfb-b93f-f673c99a32bc";
    readonly file: "Illustrative.glb";
    readonly lights: {
        readonly ambient: readonly [1, 1, 1];
        readonly light0: {
            readonly color: readonly [0, 0, 0];
            readonly rotation: readonly [0, 180, 180];
        };
        readonly light1: {
            readonly color: readonly [0, 0, 0];
            readonly rotation: readonly [0, 0, 0];
        };
    };
}, {
    readonly name: "NightSky";
    readonly guid: "c504347a-c96d-4505-853b-87b484acff9a";
    readonly file: "NightSky.glb";
    readonly lights: {
        readonly ambient: readonly [0.3019608, 0.3019608, 0.6039216];
        readonly light0: {
            readonly color: readonly [1.02352941, 0.7647059, 0.929411769];
            readonly rotation: readonly [65, 0, 25.9999981];
        };
        readonly light1: {
            readonly color: readonly [0, 0, 0];
            readonly rotation: readonly [0, 0, 0];
        };
    };
}, {
    readonly name: "Passthrough";
    readonly guid: "e38af599-4575-46ff-a040-459703dbcd36";
    readonly file: "Passthrough.glb";
    readonly lights: {
        readonly ambient: readonly [0.5, 0.5, 0.5];
        readonly light0: {
            readonly color: readonly [1.16949809, 1.19485855, 1.31320751];
            readonly rotation: readonly [60.0000038, 0, 25.9999962];
        };
        readonly light1: {
            readonly color: readonly [0.428235322, 0.4211765, 0.3458824];
            readonly rotation: readonly [40.0000038, 180, 220];
        };
    };
}, {
    readonly name: "Pedestal";
    readonly guid: "ab080511-e465-4a6d-8587-53bf495af68b";
    readonly file: "Pedestal.glb";
    readonly lights: {
        readonly ambient: readonly [0.4117647, 0.3529412, 0.596078455];
        readonly light0: {
            readonly color: readonly [1.1152941, 0.917647064, 0.7764706];
            readonly rotation: readonly [50, 41.9999962, 25.9999924];
        };
        readonly light1: {
            readonly color: readonly [0.356862754, 0.3509804, 0.2882353];
            readonly rotation: readonly [40.0000038, 227, 220];
        };
    };
}, {
    readonly name: "PinkLemonade";
    readonly guid: "36e65e4f-17d7-41ef-834a-e525db0b9888";
    readonly file: "PinkLemonade.glb";
    readonly lights: {
        readonly ambient: readonly [1, 0.9019608, 0.854901969];
        readonly light0: {
            readonly color: readonly [0, 0, 0];
            readonly rotation: readonly [318.189667, 116.565048, 116.565048];
        };
        readonly light1: {
            readonly color: readonly [0.5, 0.28039217, 0.3156863];
            readonly rotation: readonly [0, 0, 0];
        };
    };
}, {
    readonly name: "Pistachio";
    readonly guid: "a9bc2bc8-6d86-4cda-82a9-283e0f3977ac";
    readonly file: "Pistachio.glb";
    readonly lights: {
        readonly ambient: readonly [0.610186, 0.838235259, 0.75194633];
        readonly light0: {
            readonly color: readonly [0.209818333, 0.242647052, 0.171280265];
            readonly rotation: readonly [41.810318, 116.565048, 243.434937];
        };
        readonly light1: {
            readonly color: readonly [0.977941155, 0.506417, 0.438635379];
            readonly rotation: readonly [0, 0, 0];
        };
    };
}, {
    readonly name: "Snowman";
    readonly guid: "ab080511-e565-4a6d-8587-53bf495af68b";
    readonly file: "Snowman.glb";
    readonly lights: {
        readonly ambient: readonly [0.7294118, 0.7294118, 0.7294118];
        readonly light0: {
            readonly color: readonly [0.241451, 0.234078437, 0.3465098];
            readonly rotation: readonly [58, 315.999969, 50.0000038];
        };
        readonly light1: {
            readonly color: readonly [0.410980433, 0.4956863, 0.65882355];
            readonly rotation: readonly [40, 143, 220];
        };
    };
}, {
    readonly name: "Space";
    readonly guid: "96cf6f36-47b6-44f4-bdbf-63be2ddac909";
    readonly file: "Space.glb";
    readonly lights: {
        readonly ambient: readonly [0.227450982, 0.20784314, 0.360784322];
        readonly light0: {
            readonly color: readonly [1.16000009, 0.866666734, 0.866666734];
            readonly rotation: readonly [30.0000019, 39.9999962, 50];
        };
        readonly light1: {
            readonly color: readonly [0, 0, 0];
            readonly rotation: readonly [0, 0, 0];
        };
    };
}, {
    readonly name: "Standard";
    readonly guid: "ab080599-e465-4a6d-8587-43bf495af68b";
    readonly file: "Standard.glb";
    readonly lights: {
        readonly ambient: readonly [0.392156869, 0.392156869, 0.392156869];
        readonly light0: {
            readonly color: readonly [0.7780392, 0.815686345, 0.9913726];
            readonly rotation: readonly [60.0000038, 0, 25.9999962];
        };
        readonly light1: {
            readonly color: readonly [0.428235322, 0.4211765, 0.3458824];
            readonly rotation: readonly [40.0000038, 180, 220];
        };
    };
}, {
    readonly name: "White";
    readonly guid: "9b89b0a4-c41e-4b78-82a1-22f10a238357";
    readonly file: "White.glb";
    readonly lights: {
        readonly ambient: readonly [0.392156869, 0.392156869, 0.392156869];
        readonly light0: {
            readonly color: readonly [0.7780392, 0.815686345, 0.9913726];
            readonly rotation: readonly [60.0000038, 0, 25.9999962];
        };
        readonly light1: {
            readonly color: readonly [0.428235322, 0.4211765, 0.3458824];
            readonly rotation: readonly [40.0000038, 180, 220];
        };
    };
}];
type EnvironmentEntry = (typeof ENVIRONMENT_MANIFEST)[number];
export declare function parseTBColorString(colorString: string | undefined, fallback: Color): Color;
export declare function parseTBVector3(vectorString: string | undefined, fallback: Vector3): Vector3;
export declare class TiltEnvironmentLoader {
    /**
     * Load environment geometry under `sketchRoot`, and attach scene lights as siblings
     * of the env (not children of the π-Y-flipped env mesh).
     */
    load(sketchRoot: Object3D, userData: Record<string, unknown>): Promise<{
        environment: Object3D;
        ambient: AmbientLight;
        fog: FogExp2;
    }>;
    /**
     * Resolve environment preset from sketch `TB_EnvironmentGuid` / `TB_Environment` extras.
     * Falls back to Standard with a console warning when metadata is missing or unknown.
     */
    resolveEnvironment(userData: Record<string, unknown>): EnvironmentEntry;
    /**
     * Resolve lights:
     * 1. `TB_SceneLight*` / `TB_AmbientLightColor` extras when present
     * 2. else `node_SceneLight_*` eulers from the sketch GLTF
     * 3. else environment preset
     */
    resolveSceneLights(userData: Record<string, unknown> | null | undefined, env: EnvironmentEntry, sceneLightNodes?: Object3D[]): {
        ambient: Color;
        light0Color: Color;
        light1Color: Color;
        light0Rotation: Vector3;
        light1Rotation: Vector3;
    };
    generateGradientSky(colorA: Color, colorB: Color, direction: Vector3): Mesh;
}
export {};
