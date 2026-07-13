import { AmbientLight, BackSide, CanvasTexture, ClampToEdgeWrapping, Color, DirectionalLight, Euler, FogExp2, MathUtils, Mesh, MeshBasicMaterial, Quaternion, RepeatWrapping, SphereGeometry, SRGBColorSpace, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const gltfLoader = new GLTFLoader();
const ENVIRONMENT_DIR = '/assets/environments/';
const DEFAULT_ENVIRONMENT_NAME = 'Standard';
/** Open Brush environment presets (lights from gallery-viewer / Open Brush assets). */
const ENVIRONMENT_MANIFEST = [
    {
        name: 'Black',
        guid: '580b4529-ac50-4fe9-b8d2-635765a14893',
        file: 'Black.glb',
        lights: {
            ambient: [0.392156869, 0.392156869, 0.392156869],
            light0: { color: [0.7780392, 0.815686345, 0.9913726], rotation: [60.0000038, 0.0, 25.9999962] },
            light1: { color: [0.428235322, 0.4211765, 0.3458824], rotation: [40.0000038, 180.0, 220.0] },
        },
    },
    {
        name: 'Blue',
        guid: '0ca88298-e5e8-4e94-aad8-4b4f6c80ae52',
        file: 'Blue.glb',
        lights: {
            ambient: [0.203921571, 0.294117659, 0.368627459],
            light0: { color: [1.5533334, 1.40666676, 1.77333343], rotation: [60.0000038, 0.0, 25.9999962] },
            light1: { color: [0.271215677, 0.2667451, 0.219058827], rotation: [40.0000038, 180.0, 220.0] },
        },
    },
    {
        name: 'DressForm',
        guid: 'e2e72b76-d443-4721-97e6-f3d49fe98dda',
        file: 'DressForm.glb',
        lights: {
            ambient: [0.4117647, 0.3529412, 0.596078455],
            light0: { color: [1.1152941, 0.917647064, 0.7764706], rotation: [50.0, 41.9999962, 25.9999924] },
            light1: { color: [0.356862754, 0.3509804, 0.2882353], rotation: [40.0000038, 227.0, 220.0] },
        },
    },
    {
        name: 'Illustrative',
        guid: 'e65cde1a-a177-4bfb-b93f-f673c99a32bc',
        file: 'Illustrative.glb',
        lights: {
            ambient: [1.0, 1.0, 1.0],
            light0: { color: [0.0, 0.0, 0.0], rotation: [0.0, 180.0, 180.0] },
            light1: { color: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0] },
        },
    },
    {
        name: 'NightSky',
        guid: 'c504347a-c96d-4505-853b-87b484acff9a',
        file: 'NightSky.glb',
        lights: {
            ambient: [0.3019608, 0.3019608, 0.6039216],
            light0: { color: [1.02352941, 0.7647059, 0.929411769], rotation: [65.0, 0.0, 25.9999981] },
            light1: { color: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0] },
        },
    },
    {
        name: 'Passthrough',
        guid: 'e38af599-4575-46ff-a040-459703dbcd36',
        file: 'Passthrough.glb',
        lights: {
            ambient: [0.5, 0.5, 0.5],
            light0: { color: [1.16949809, 1.19485855, 1.31320751], rotation: [60.0000038, 0.0, 25.9999962] },
            light1: { color: [0.428235322, 0.4211765, 0.3458824], rotation: [40.0000038, 180.0, 220.0] },
        },
    },
    {
        name: 'Pedestal',
        guid: 'ab080511-e465-4a6d-8587-53bf495af68b',
        file: 'Pedestal.glb',
        lights: {
            ambient: [0.4117647, 0.3529412, 0.596078455],
            light0: { color: [1.1152941, 0.917647064, 0.7764706], rotation: [50.0, 41.9999962, 25.9999924] },
            light1: { color: [0.356862754, 0.3509804, 0.2882353], rotation: [40.0000038, 227.0, 220.0] },
        },
    },
    {
        name: 'PinkLemonade',
        guid: '36e65e4f-17d7-41ef-834a-e525db0b9888',
        file: 'PinkLemonade.glb',
        lights: {
            ambient: [1.0, 0.9019608, 0.854901969],
            light0: { color: [0.0, 0.0, 0.0], rotation: [318.189667, 116.565048, 116.565048] },
            light1: { color: [0.5, 0.28039217, 0.3156863], rotation: [0.0, 0.0, 0.0] },
        },
    },
    {
        name: 'Pistachio',
        guid: 'a9bc2bc8-6d86-4cda-82a9-283e0f3977ac',
        file: 'Pistachio.glb',
        lights: {
            ambient: [0.610186, 0.838235259, 0.75194633],
            light0: { color: [0.209818333, 0.242647052, 0.171280265], rotation: [41.810318, 116.565048, 243.434937] },
            light1: { color: [0.977941155, 0.506417, 0.438635379], rotation: [0.0, 0.0, 0.0] },
        },
    },
    {
        name: 'Snowman',
        guid: 'ab080511-e565-4a6d-8587-53bf495af68b',
        file: 'Snowman.glb',
        lights: {
            ambient: [0.7294118, 0.7294118, 0.7294118],
            light0: { color: [0.241451, 0.234078437, 0.3465098], rotation: [58.0, 315.999969, 50.0000038] },
            light1: { color: [0.410980433, 0.4956863, 0.65882355], rotation: [40.0, 143.0, 220.0] },
        },
    },
    {
        name: 'Space',
        guid: '96cf6f36-47b6-44f4-bdbf-63be2ddac909',
        file: 'Space.glb',
        lights: {
            ambient: [0.227450982, 0.20784314, 0.360784322],
            light0: { color: [1.16000009, 0.866666734, 0.866666734], rotation: [30.0000019, 39.9999962, 50.0] },
            light1: { color: [0.0, 0.0, 0.0], rotation: [0.0, 0.0, 0.0] },
        },
    },
    {
        name: 'Standard',
        guid: 'ab080599-e465-4a6d-8587-43bf495af68b',
        file: 'Standard.glb',
        lights: {
            ambient: [0.392156869, 0.392156869, 0.392156869],
            light0: { color: [0.7780392, 0.815686345, 0.9913726], rotation: [60.0000038, 0.0, 25.9999962] },
            light1: { color: [0.428235322, 0.4211765, 0.3458824], rotation: [40.0000038, 180.0, 220.0] },
        },
    },
    {
        name: 'White',
        guid: '9b89b0a4-c41e-4b78-82a1-22f10a238357',
        file: 'White.glb',
        lights: {
            ambient: [0.392156869, 0.392156869, 0.392156869],
            light0: { color: [0.7780392, 0.815686345, 0.9913726], rotation: [60.0000038, 0.0, 25.9999962] },
            light1: { color: [0.428235322, 0.4211765, 0.3458824], rotation: [40.0000038, 180.0, 220.0] },
        },
    },
];
const ENVIRONMENT_BY_GUID = new Map(ENVIRONMENT_MANIFEST.map((e) => [e.guid.toLowerCase(), e]));
const ENVIRONMENT_BY_NAME = new Map(ENVIRONMENT_MANIFEST.map((e) => [e.name.toLowerCase(), e]));
const DEFAULT_ENVIRONMENT = ENVIRONMENT_BY_NAME.get(DEFAULT_ENVIRONMENT_NAME.toLowerCase());
function rgbColor(rgb) {
    return new Color(rgb[0], rgb[1], rgb[2]);
}
function rgbVector(rgb) {
    return new Vector3(rgb[0], rgb[1], rgb[2]);
}
export function parseTBColorString(colorString, fallback) {
    if (!colorString)
        return fallback.clone();
    const [r, g, b] = colorString.split(',').map(parseFloat);
    return new Color(r, g, b);
}
export function parseTBVector3(vectorString, fallback) {
    if (!vectorString)
        return fallback.clone();
    const [x, y, z] = vectorString.split(',').map((p) => parseFloat(p.trim()));
    return new Vector3(x, y, z);
}
/**
 * Euler degrees → XYZ radians, +π Y, aim from (0,0,1) × 10.
 * DirectionalLight.rotation stays identity; direction is encoded in position.
 */
function lightDirectionFromTBEuler(rotDeg, flipY) {
    const euler = new Euler(MathUtils.degToRad(rotDeg.x), MathUtils.degToRad(rotDeg.y), MathUtils.degToRad(rotDeg.z), 'XYZ');
    if (flipY)
        euler.y += Math.PI;
    return new Vector3(0, 0, -1).applyEuler(euler).multiplyScalar(10);
}
/** Collect and detach Poly `node_SceneLight_*` dummies (rotation sources). */
function takeSceneLightNodes(root) {
    const nodes = [];
    root.traverse((node) => {
        if (node.name?.startsWith('node_SceneLight_')) {
            nodes.push(node);
        }
    });
    // Stable order: SceneLight_0 before SceneLight_1 when names allow.
    nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const node of nodes) {
        node.parent?.remove(node);
    }
    return nodes.slice(0, 2);
}
function eulerDegreesFromNode(node) {
    return new Vector3(MathUtils.radToDeg(node.rotation.x), MathUtils.radToDeg(node.rotation.y), MathUtils.radToDeg(node.rotation.z));
}
export class TiltEnvironmentLoader {
    /**
     * Load environment geometry under `sketchRoot`, and attach scene lights as siblings
     * of the env (not children of the π-Y-flipped env mesh).
     */
    async load(sketchRoot, userData) {
        const env = this.resolveEnvironment(userData);
        const url = `${ENVIRONMENT_DIR}${env.file}`;
        // Prefer rotations from sketch `node_SceneLight_*` over env preset.
        const sceneLightNodes = takeSceneLightNodes(sketchRoot);
        const envGltf = await gltfLoader.loadAsync(url);
        // GLTF 1.0 / Poly exports need a 180° Y flip + 0.1 scale (same as gallery-viewer).
        envGltf.scene.setRotationFromEuler(new Euler(0, Math.PI, 0));
        envGltf.scene.scale.set(0.1, 0.1, 0.1);
        envGltf.scene.name = `Environment_${env.name}`;
        // Add gradient sky (under flipped env so it matches env orientation).
        const skyColorA = parseTBColorString(userData['TB_SkyColorA'], new Color(0.274509817, 0.274509817, 0.31764707));
        const skyColorB = parseTBColorString(userData['TB_SkyColorB'], new Color(0.03529412, 0.03529412, 0.08627451));
        const skyDir = parseTBVector3(userData['TB_SkyGradientDirection'], new Vector3(0, 1, 0));
        envGltf.scene.add(this.generateGradientSky(skyColorA, skyColorB, skyDir));
        sketchRoot.add(envGltf.scene);
        // Poly / LegacyGLTF path is always V1 → +π Y.
        const lights = this.resolveSceneLights(userData, env, sceneLightNodes);
        const flipY = true;
        const l0 = new DirectionalLight(lights.light0Color, 1.0);
        l0.name = 'SceneLight0';
        const l1 = new DirectionalLight(lights.light1Color, 1.0);
        l1.name = 'SceneLight1';
        l0.position.copy(lightDirectionFromTBEuler(lights.light0Rotation, flipY));
        l1.position.copy(lightDirectionFromTBEuler(lights.light1Rotation, flipY));
        l0.castShadow = true;
        sketchRoot.add(l0, l1);
        const ambient = new AmbientLight(lights.ambient);
        ambient.name = 'SceneAmbient';
        const fogColor = parseTBColorString(userData['TB_FogColor'], new Color(0.164705887, 0.164705887, 0.20784314));
        const fogDensity = parseFloat(String(userData['TB_FogDensity'] ?? '0.0025')) || 0.0025;
        // Match WebGL RawShader path: fog color fed to brushes is linear.
        const fog = new FogExp2(fogColor.clone().convertSRGBToLinear(), fogDensity);
        return { environment: envGltf.scene, ambient, fog };
    }
    /**
     * Resolve environment preset from sketch `TB_EnvironmentGuid` / `TB_Environment` extras.
     * Falls back to Standard with a console warning when metadata is missing or unknown.
     */
    resolveEnvironment(userData) {
        const guidRaw = userData?.['TB_EnvironmentGuid'];
        const nameRaw = userData?.['TB_Environment'];
        const guid = typeof guidRaw === 'string' ? guidRaw.trim().toLowerCase() : '';
        const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
        const byGuid = guid ? ENVIRONMENT_BY_GUID.get(guid) : undefined;
        if (byGuid)
            return byGuid;
        const byName = name ? ENVIRONMENT_BY_NAME.get(name.toLowerCase()) : undefined;
        if (byName)
            return byName;
        if (!guid && !name) {
            console.warn('[tilt] No TB_EnvironmentGuid / TB_Environment in sketch metadata; loading Standard.');
        }
        else {
            console.warn(`[tilt] Unknown environment metadata (guid=${guid || '—'}, name=${name || '—'}); loading Standard.`);
        }
        return DEFAULT_ENVIRONMENT;
    }
    /**
     * Resolve lights:
     * 1. `TB_SceneLight*` / `TB_AmbientLightColor` extras when present
     * 2. else `node_SceneLight_*` eulers from the sketch GLTF
     * 3. else environment preset
     */
    resolveSceneLights(userData, env, sceneLightNodes = []) {
        const preset = env.lights;
        const ambient = parseTBColorString(userData?.['TB_AmbientLightColor'], rgbColor(preset.ambient));
        const light0Color = parseTBColorString(userData?.['TB_SceneLight0Color'], rgbColor(preset.light0.color));
        const light1Color = parseTBColorString(userData?.['TB_SceneLight1Color'], rgbColor(preset.light1.color));
        const hasTB0 = typeof userData?.['TB_SceneLight0Rotation'] === 'string';
        const hasTB1 = typeof userData?.['TB_SceneLight1Rotation'] === 'string';
        const node0 = sceneLightNodes[0];
        const node1 = sceneLightNodes[1];
        const light0Rotation = hasTB0
            ? parseTBVector3(userData['TB_SceneLight0Rotation'], rgbVector(preset.light0.rotation))
            : node0
                ? eulerDegreesFromNode(node0)
                : rgbVector(preset.light0.rotation);
        const light1Rotation = hasTB1
            ? parseTBVector3(userData['TB_SceneLight1Rotation'], rgbVector(preset.light1.rotation))
            : node1
                ? eulerDegreesFromNode(node1)
                : rgbVector(preset.light1.rotation);
        return { ambient, light0Color, light1Color, light0Rotation, light1Rotation };
    }
    generateGradientSky(colorA, colorB, direction) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 256;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0, colorB.clone().convertSRGBToLinear().getStyle());
        gradient.addColorStop(1, colorA.clone().convertSRGBToLinear().getStyle());
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1, 256);
        const texture = new CanvasTexture(canvas);
        texture.wrapS = RepeatWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.colorSpace = SRGBColorSpace;
        const material = new MeshBasicMaterial({
            map: texture,
            side: BackSide,
        });
        material.fog = false;
        material.toneMapped = false;
        const skysphere = new Mesh(new SphereGeometry(5000, 64, 64), material);
        skysphere.name = 'environmentSky';
        const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
        skysphere.applyQuaternion(quaternion);
        return skysphere;
    }
}
