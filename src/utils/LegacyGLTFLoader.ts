// Adapted from original GLTF 1.0 Loader in three.js r86
// https://github.com/mrdoob/three.js/blob/r86/examples/js/loaders/GLTFLoader.js

import * as THREE from 'three'

export interface LegacyGLTF {
  scene: THREE.Scene;
  scenes: THREE.Scene[];
  cameras: THREE.Camera[];
  animations: unknown[];
  asset?: { generator?: string; version?: string };
  userData?: Record<string, unknown>;
}

// glTF 1.0 JSON is loosely structured; keep internals permissive.
type AnyDict = Record<string, any>

export class LegacyGLTFLoader extends THREE.Loader<LegacyGLTF> {
    assetBaseUrl: string
    reversed = false

    constructor(manager?: THREE.LoadingManager, assetBaseUrl = '') {
        super(manager)
        this.assetBaseUrl = assetBaseUrl
    }

    load(
        url: string,
        onLoad: (gltf: LegacyGLTF) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void,
    ): void {

        const scope = this

        let resourcePath: string

        if ( this.resourcePath !== '' ) {

            resourcePath = this.resourcePath

        } else if ( this.path !== '' ) {

            resourcePath = this.path

        } else {

            resourcePath = THREE.LoaderUtils.extractUrlBase( url )

        }
        const loader = new THREE.FileLoader( scope.manager )

        loader.setPath( this.path )
        loader.setResponseType( 'arraybuffer' )

        loader.load( url, function ( data ) {

            scope.parse( data as ArrayBuffer, resourcePath, onLoad )

        }, onProgress as any, onError as any )

    }

    parse(data: ArrayBuffer, path: string, callback: (gltf: LegacyGLTF) => void): void {

        let content
        const extensions: AnyDict = {}

        const magic = new TextDecoder( ).decode( new Uint8Array( data, 0, 4 ) )

        if ( magic === BINARY_EXTENSION_HEADER_DEFAULTS.magic ) {

            extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data )
            content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content

        } else {

            content = new TextDecoder( ).decode( new Uint8Array( data ) )

        }

        const json = JSON.parse( content )

        if ( json.extensionsUsed && json.extensionsUsed.indexOf( EXTENSIONS.KHR_MATERIALS_COMMON ) >= 0 ) {

            extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] = new GLTFMaterialsCommonExtension( json )

        }

        const parser = new GLTFParser( json, extensions, {

            crossOrigin: this.crossOrigin,
            manager: this.manager,
            path: path || this.resourcePath || '',
            assetBaseUrl: this.assetBaseUrl
        } )

        parser.parse( function ( scene: THREE.Scene, scenes: THREE.Scene[], cameras: THREE.Camera[], animations: unknown[] ) {

            const glTF: LegacyGLTF = {
                scene,
                scenes,
                cameras,
                animations,
            }

            callback( glTF )

        } )
    }
}

function GLTFRegistry() {

    let objects: AnyDict = {}

    return	{

        get: function ( key: string ) {

            return objects[ key ]

        },

        add: function ( key: string, object: any ) {

            objects[ key ] = object

        },

        remove: function ( key: string ) {

            delete objects[ key ]

        },

        removeAll: function () {

            objects = {}

        },

        update: function ( scene: THREE.Scene, camera: THREE.Camera ) {

            for ( const name in objects ) {

                const object = objects[ name ]

                if ( object.update ) {

                    object.update( scene, camera )

                }

            }

        }

    }

}

class GLTFShader {
    boundUniforms: AnyDict
    _m4: THREE.Matrix4

    constructor(targetNode: any, allNodes: AnyDict) {

        const boundUniforms: AnyDict = {}

        // bind each uniform to its source node

        const uniforms = targetNode.material.uniforms

        for ( const uniformId in uniforms ) {

            const uniform = uniforms[ uniformId ]

            if ( uniform.semantic ) {

                const sourceNodeRef = uniform.node

                let sourceNode = targetNode

                if ( sourceNodeRef ) {

                    sourceNode = allNodes[ sourceNodeRef ]

                }

                boundUniforms[ uniformId ] = {
                    semantic: uniform.semantic,
                    sourceNode: sourceNode,
                    targetNode: targetNode,
                    uniform: uniform
                }

            }

        }

        this.boundUniforms = boundUniforms
        this._m4 = new THREE.Matrix4()
    }

    update(_scene: THREE.Scene, camera: THREE.Camera): void {

        const boundUniforms = this.boundUniforms

        for ( const name in boundUniforms ) {

            const boundUniform = boundUniforms[ name ]

            switch ( boundUniform.semantic ) {

                case 'MODELVIEW':

                    var m4 = boundUniform.uniform.value
                    m4.multiplyMatrices( camera.matrixWorldInverse, boundUniform.sourceNode.matrixWorld )
                    break

                case 'MODELVIEWINVERSETRANSPOSE':

                    var m3 = boundUniform.uniform.value
                    this._m4.multiplyMatrices( camera.matrixWorldInverse, boundUniform.sourceNode.matrixWorld )
                    m3.getNormalMatrix( this._m4 )
                    break

                case 'PROJECTION':

                    var m4 = boundUniform.uniform.value
                    m4.copy( camera.projectionMatrix )
                    break

                case 'JOINTMATRIX':

                    var m4v = boundUniform.uniform.value

                    for ( let mi = 0; mi < m4v.length; mi ++ ) {

                        // So it goes like this:
                        // SkinnedMesh world matrix is already baked into MODELVIEW;
                        // transform joints to local space,
                        // then transform using joint's inverse
                        m4v[ mi ]
                            .copy( boundUniform.sourceNode.matrixWorld ).invert()
                            .multiply( boundUniform.targetNode.skeleton.bones[ mi ].matrixWorld )
                            .multiply( boundUniform.targetNode.skeleton.boneInverses[ mi ] )
                            .multiply( boundUniform.targetNode.bindMatrix )

                    }

                    break

                default :

                    console.warn( 'Unhandled shader semantic: ' + boundUniform.semantic )
                    break

            }

        }
    }


}

const EXTENSIONS = {
    KHR_BINARY_GLTF: 'KHR_binary_glTF',
    KHR_MATERIALS_COMMON: 'KHR_materials_common'
}

class GLTFMaterialsCommonExtension {
    name: string
    lights: AnyDict

    constructor(json: AnyDict) {

    this.name = EXTENSIONS.KHR_MATERIALS_COMMON

    this.lights = {}

    const extension = ( json.extensions && json.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] ) || {}
    const lights = extension.lights || {}

    for ( const lightId in lights ) {

        const light = lights[ lightId ]
        var lightNode

        const lightParams = light[ light.type ]
        const color = new THREE.Color().fromArray( lightParams.color )

        switch ( light.type ) {

            case 'directional':
                lightNode = new THREE.DirectionalLight( color )
                lightNode.position.set( 0, 0, 1 )
                break

            case 'point':
                lightNode = new THREE.PointLight( color )
                break

            case 'spot':
                lightNode = new THREE.SpotLight( color )
                lightNode.position.set( 0, 0, 1 )
                break

            case 'ambient':
                lightNode = new THREE.AmbientLight( color )
                break

        }

        if ( lightNode ) {

            this.lights[ lightId ] = lightNode

        }

    }
}
}

const BINARY_EXTENSION_BUFFER_NAME = 'binary_glTF'

const BINARY_EXTENSION_HEADER_DEFAULTS = { magic: 'glTF', version: 1, contentFormat: 0 }

const BINARY_EXTENSION_HEADER_LENGTH = 20

class GLTFBinaryExtension {
    name: string
    header: AnyDict
    content: string
    body: ArrayBuffer

    constructor(data: ArrayBuffer) {

        this.name = EXTENSIONS.KHR_BINARY_GLTF

        const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH )

        const header = {
            magic: new TextDecoder( ).decode( new Uint8Array( data.slice( 0, 4 ) ) ),
            version: headerView.getUint32( 4, true ),
            length: headerView.getUint32( 8, true ),
            contentLength: headerView.getUint32( 12, true ),
            contentFormat: headerView.getUint32( 16, true )
        }

        for ( const key in BINARY_EXTENSION_HEADER_DEFAULTS ) {

            const value = (BINARY_EXTENSION_HEADER_DEFAULTS as AnyDict)[ key ]

            if ( (header as AnyDict)[ key ] !== value ) {

                throw new Error( `Unsupported glTF-Binary header: Expected "${key}" to be "${value}".` )

            }

        }

        const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH, header.contentLength )

        this.header = header
        this.content = new TextDecoder( ).decode( contentArray )
        this.body = data.slice( BINARY_EXTENSION_HEADER_LENGTH + header.contentLength, header.length )
    }

    loadShader(shader: AnyDict, bufferViews: AnyDict): string {

        const bufferView = bufferViews[ shader.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].bufferView ]
        const array = new Uint8Array( bufferView )

        return new TextDecoder( ).decode( array )

    }
}

const WEBGL_CONSTANTS = {
    FLOAT: 5126,
    FLOAT_MAT2: 35674,
    FLOAT_MAT3: 35675,
    FLOAT_MAT4: 35676,
    FLOAT_VEC2: 35664,
    FLOAT_VEC3: 35665,
    FLOAT_VEC4: 35666,
    LINEAR: 9729,
    REPEAT: 10497,
    SAMPLER_2D: 35678,
    TRIANGLES: 4,
    LINES: 1,
    UNSIGNED_BYTE: 5121,
    UNSIGNED_SHORT: 5123,

    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632
}

const WEBGL_TYPE: Record<number, any> = {
    5126: Number,
    //35674: Matrix2,
    35675: THREE.Matrix3,
    35676: THREE.Matrix4,
    35664: THREE.Vector2,
    35665: THREE.Vector3,
    35666: THREE.Vector4,
    35678: THREE.Texture
}

const WEBGL_COMPONENT_TYPES: Record<number, any> = {
    5120: Int8Array,
    5121: Uint8Array,
    5122: Int16Array,
    5123: Uint16Array,
    5125: Uint32Array,
    5126: Float32Array
}





const WEBGL_SIDES: Record<number, THREE.Side> = {
    1028: THREE.BackSide, // Culling front
    1029: THREE.FrontSide // Culling back
    //1032: NoSide   // Culling front and back, what to do?
}

const WEBGL_DEPTH_FUNCS: Record<number, THREE.DepthModes> = {
    512: THREE.NeverDepth,
    513: THREE.LessDepth,
    514: THREE.EqualDepth,
    515: THREE.LessEqualDepth,
    516: THREE.GreaterEqualDepth,
    517: THREE.NotEqualDepth,
    518: THREE.GreaterEqualDepth,
    519: THREE.AlwaysDepth
}

const WEBGL_BLEND_EQUATIONS: Record<number, THREE.BlendingEquation> = {
    32774: THREE.AddEquation,
    32778: THREE.SubtractEquation,
    32779: THREE.ReverseSubtractEquation
}

const WEBGL_BLEND_FUNCS: Record<number, any> = {
    0: THREE.ZeroFactor,
    1: THREE.OneFactor,
    768: THREE.SrcColorFactor,
    769: THREE.OneMinusSrcColorFactor,
    770: THREE.SrcAlphaFactor,
    771: THREE.OneMinusSrcAlphaFactor,
    772: THREE.DstAlphaFactor,
    773: THREE.OneMinusDstAlphaFactor,
    774: THREE.DstColorFactor,
    775: THREE.OneMinusDstColorFactor,
    776: THREE.SrcAlphaSaturateFactor
    // The followings are not supported by js yet
    //32769: CONSTANT_COLOR,
    //32770: ONE_MINUS_CONSTANT_COLOR,
    //32771: CONSTANT_ALPHA,
    //32772: ONE_MINUS_CONSTANT_COLOR
}

const WEBGL_TYPE_SIZES: Record<string, number> = {
    'SCALAR': 1,
    'VEC2': 2,
    'VEC3': 3,
    'VEC4': 4,
    'MAT2': 4,
    'MAT3': 9,
    'MAT4': 16
}

const WEBGL_FILTERS: Record<number, number> = {
    9728: THREE.NearestFilter,
    9729: THREE.LinearFilter,
    9984: THREE.NearestMipmapNearestFilter,
    9985: THREE.LinearMipmapNearestFilter,
    9986: THREE.NearestMipmapLinearFilter,
    9987: THREE.LinearMipmapLinearFilter,
}

const WEBGL_WRAPPINGS: Record<number, THREE.Wrapping> = {
    33071: THREE.ClampToEdgeWrapping,
    33648: THREE.MirroredRepeatWrapping,
    10497: THREE.RepeatWrapping,
}

const WEBGL_TEXTURE_FORMATS: Record<number, THREE.PixelFormat> = {
    6406: THREE.AlphaFormat,
    6407: THREE.RGBAFormat, // RGBFormat removed; treat as RGBA
    6408: THREE.RGBAFormat,
}

const WEBGL_TEXTURE_DATATYPES: Record<number, THREE.TextureDataType> = {
    5121: THREE.UnsignedByteType,
    32819: THREE.UnsignedShort4444Type,
    32820: THREE.UnsignedShort5551Type,
}

const PATH_PROPERTIES: Record<string, string> = {
    scale: 'scale',
    translation: 'position',
    rotation: 'quaternion'
}

const INTERPOLATION: Record<string, THREE.InterpolationModes> = {
    LINEAR: THREE.InterpolateLinear,
    STEP: THREE.InterpolateDiscrete
}

const STATES_ENABLES: Record<number, string> = {
    2884: 'CULL_FACE',
    2929: 'DEPTH_TEST',
    3042: 'BLEND',
    3089: 'SCISSOR_TEST',
    32823: 'POLYGON_OFFSET_FILL',
    32926: 'SAMPLE_ALPHA_TO_COVERAGE'
}

function _each(object: any, callback: (value: any, key: any) => any, thisObj?: any): Promise<any> {

    if ( ! object ) {

        return Promise.resolve()

    }

    let results: any
    const fns: any[] = []

    if ( Object.prototype.toString.call( object ) === '[object Array]' ) {

        results = []

        const length = object.length

        for ( let idx = 0; idx < length; idx ++ ) {

            var value = callback.call( thisObj || null, object[ idx ], idx )

            if ( value ) {

                fns.push( value )

                if ( value instanceof Promise ) {

                    value.then( ( function ( this: any, key: any, value: any ) {

                        results[ key ] = value

                    } as any ).bind( null, idx ) )

                } else {

                    results[ idx ] = value

                }

            }

        }

    } else {

        results = {}

        for ( const key in object ) {

            if ( object.hasOwnProperty( key ) ) {

                var value = callback.call( thisObj || null, object[ key ], key )

                if ( value ) {

                    fns.push( value )

                    if ( value instanceof Promise ) {

                        value.then( ( function ( this: any, key: any, value: any ) {

                            results[ key ] = value

                        } as any ).bind( null, key ) )

                    } else {

                        results[ key ] = value

                    }

                }

            }

        }

    }

    return Promise.all( fns ).then( function () {

        return results

    } )

}

function resolveURL(url: string, path: string): string {

    // Invalid URL
    if ( typeof url !== 'string' || url === '' )
        return ''

    // Absolute URL http://,https://,//
    if ( /^(https?:)?\/\//i.test( url ) ) {

        return url

    }

    // Data URI
    if ( /^data:.*,.*$/i.test( url ) ) {

        return url

    }

    // Blob URL
    if ( /^blob:.*$/i.test( url ) ) {

        return url

    }

    // Relative URL
    return ( path || '' ) + url

}


function createDefaultMaterial(): THREE.Material {

    return new THREE.MeshPhongMaterial( {
        color: 0x00000,
        emissive: 0x888888,
        transparent: false,
        depthTest: true,
        side: THREE.FrontSide
    } as THREE.MeshPhongMaterialParameters )

}

class DeferredShaderMaterial {
    isDeferredShaderMaterial = true
    params: AnyDict

    constructor(params: AnyDict) {
        this.params = params
    }

    create(): THREE.RawShaderMaterial {

        const uniforms = THREE.UniformsUtils.clone( this.params.uniforms )

        for ( const uniformId in this.params.uniforms ) {

            const originalUniform = this.params.uniforms[ uniformId ]

            if ( originalUniform.value instanceof THREE.Texture ) {

                uniforms[ uniformId ].value = originalUniform.value
                uniforms[ uniformId ].value.needsUpdate = true

            }

            uniforms[ uniformId ].semantic = originalUniform.semantic
            uniforms[ uniformId ].node = originalUniform.node

        }

        this.params.uniforms = uniforms

        return new THREE.RawShaderMaterial( this.params )
    }
}

class GLTFParser {
    json: AnyDict
    extensions: AnyDict
    options: AnyDict
    cache: ReturnType<typeof GLTFRegistry>

    constructor(json: AnyDict, extensions: AnyDict, options: AnyDict) {
        this.json = json || {}
        this.extensions = extensions || {}
        this.options = options || {}

        // loader object cache
        this.cache = GLTFRegistry()
    }

    _withDependencies(dependencies: string[]): Promise<AnyDict> {

        const _dependencies: AnyDict = {}

        for ( let i = 0; i < dependencies.length; i ++ ) {

            const dependency = dependencies[ i ]
            const fnName = 'load' + dependency.charAt( 0 ).toUpperCase() + dependency.slice( 1 )

            const cached = this.cache.get( dependency )

            if ( cached !== undefined ) {

                _dependencies[ dependency ] = cached

            } else if ( typeof (this as any)[ fnName ] === 'function' ) {

                const fn = (this as any)[ fnName ]()
                this.cache.add( dependency, fn )

                _dependencies[ dependency ] = fn

            }

        }

        return _each( _dependencies, function ( dependency ) {

            return dependency

        } )

    }

    parse(callback: (scene: THREE.Scene, scenes: THREE.Scene[], cameras: THREE.Camera[], animations: unknown[]) => void): void {

        const json = this.json

        // Clear the loader cache
        this.cache.removeAll()

        // Fire the callback on complete
        this._withDependencies( [

            'scenes',
            'cameras',
            'animations'

        ] ).then( function ( dependencies ) {

            const scenes = []

            for ( var name in dependencies.scenes ) {

                scenes.push( dependencies.scenes[ name ] )

            }

            const scene = json.scene !== undefined ? dependencies.scenes[ json.scene ] : scenes[ 0 ]

            const cameras = []

            for ( var name in dependencies.cameras ) {

                const camera = dependencies.cameras[ name ]
                cameras.push( camera )

            }

            const animations = []

            for ( var name in dependencies.animations ) {

                animations.push( dependencies.animations[ name ] )

            }

            callback( scene, scenes, cameras, animations )

        } )

    }

    loadShaders() {

        const json = this.json

        // Skip shader loading entirely since materials get completely replaced by replaceBrushMaterials()
        // Just return empty shaders for all shader references to avoid breaking the material loading pipeline
        return Promise.resolve( _each( json.shaders, function () {
            return '' // Return empty string for each shader
        } ) )

    }

    loadBuffers() {
        const json = this.json
        const extensions = this.extensions
        const options = this.options

        return _each( json.buffers, function ( buffer, name ) {

            if ( name === BINARY_EXTENSION_BUFFER_NAME ) {

                return extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body

            }

            if ( buffer.type === 'arraybuffer' || buffer.type === undefined ) {

                return new Promise( function ( resolve ) {

                    const loader = new THREE.FileLoader( options.manager )
                    loader.setResponseType( 'arraybuffer' )
                    loader.setCrossOrigin('no-cors')
                    loader.load( resolveURL( buffer.uri, options.path ), function ( buffer ) {

                        resolve( buffer )

                    } )

                } )

            } else {

                console.warn( 'THREE.LegacyGLTFLoader: ' + buffer.type + ' buffer type is not supported' )

            }

        } )

    }

    loadBufferViews() {

        const json = this.json

        return this._withDependencies( [

            'buffers'

        ] ).then( function ( dependencies ) {

            return _each( json.bufferViews, function ( bufferView ) {

                const arraybuffer = dependencies.buffers[ bufferView.buffer ]

                const byteLength = bufferView.byteLength !== undefined ? bufferView.byteLength : 0

                return arraybuffer.slice( bufferView.byteOffset, bufferView.byteOffset + byteLength )

            } )

        } )

    }

    loadAccessors() {

        const json = this.json

        return this._withDependencies( [

            'bufferViews'

        ] ).then( function ( dependencies ) {

            return _each( json.accessors, function ( accessor ) {

                const arraybuffer = dependencies.bufferViews[ accessor.bufferView ]
                const itemSize = WEBGL_TYPE_SIZES[ accessor.type ]
                const TypedArray = WEBGL_COMPONENT_TYPES[ accessor.componentType ]

                // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
                const elementBytes = TypedArray.BYTES_PER_ELEMENT
                const itemBytes = elementBytes * itemSize

                // The buffer is not interleaved if the stride is the item size in bytes.
                if ( accessor.byteStride && accessor.byteStride !== itemBytes ) {

                    // Use the full buffer if it's interleaved.
                    var array = new TypedArray( arraybuffer )

                    // Integer parameters to IB/IBA are in array elements, not bytes.
                    const ib = new THREE.InterleavedBuffer( array, accessor.byteStride / elementBytes )

                    return new THREE.InterleavedBufferAttribute( ib, itemSize, accessor.byteOffset / elementBytes )

                } else {

                    array = new TypedArray( arraybuffer, accessor.byteOffset, accessor.count * itemSize )

                    return new THREE.BufferAttribute( array, itemSize )

                }

            } )

        } )

    }

    loadTextures() {
        const json = this.json
        const options = this.options

        // Brush MainTex/BumpMap URLs on tiltbrush.com are replaced by TiltShaderLoader.
        // Sketch-local textures (Poly PbrTemplate BaseColorTex) must still be loaded.
        return _each(json.textures, function (texture: AnyDict) {
            if (!texture?.source) return null

            const source = json.images?.[texture.source]
            if (!source?.uri) return null

            const sourceUri: string = source.uri
            // Skip remote brush-package textures; only load relative / data / blob URIs.
            if (/^(https?:)?\/\//i.test(sourceUri)) return null

            return new Promise(function (resolve) {
                const textureLoader = new THREE.TextureLoader(options.manager)
                textureLoader.setCrossOrigin(options.crossOrigin)

                textureLoader.load(
                    resolveURL(sourceUri, options.path),
                    function (_texture) {
                        _texture.flipY = false
                        if (texture.name !== undefined) _texture.name = texture.name
                        else _texture.name = String(texture.source)

                        if (/BaseColor|baseColor|diffuse/i.test(_texture.name + sourceUri)) {
                            _texture.colorSpace = THREE.SRGBColorSpace
                        }

                        _texture.format =
                            texture.format !== undefined
                                ? WEBGL_TEXTURE_FORMATS[texture.format] ?? THREE.RGBAFormat
                                : THREE.RGBAFormat
                        _texture.type =
                            texture.type !== undefined
                                ? WEBGL_TEXTURE_DATATYPES[texture.type] ?? THREE.UnsignedByteType
                                : THREE.UnsignedByteType

                        if (texture.sampler && json.samplers?.[texture.sampler]) {
                            const sampler = json.samplers[texture.sampler]
                            _texture.magFilter = (WEBGL_FILTERS[sampler.magFilter] || THREE.LinearFilter) as THREE.MagnificationTextureFilter
                            _texture.minFilter =
                                (WEBGL_FILTERS[sampler.minFilter] || THREE.LinearMipmapLinearFilter) as THREE.MinificationTextureFilter
                            _texture.wrapS = WEBGL_WRAPPINGS[sampler.wrapS] || THREE.RepeatWrapping
                            _texture.wrapT = WEBGL_WRAPPINGS[sampler.wrapT] || THREE.RepeatWrapping
                        }

                        resolve(_texture)
                    },
                    undefined,
                    function () {
                        console.warn(
                            '[LegacyGLTFLoader] Failed to load texture:',
                            resolveURL(sourceUri, options.path),
                        )
                        resolve(null)
                    },
                )
            })
        })
    }

    loadMaterials() {

        const json = this.json

        return this._withDependencies( [

            'shaders',
            'textures'

        ] ).then( function ( dependencies ) {

            return _each( json.materials, function ( material ) {

                let materialType: any
                const materialValues: AnyDict = {}
                const materialParams: AnyDict = {}

                let khr_material: any

                if ( material.extensions && material.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ] ) {

                    khr_material = material.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ]

                }

                if ( khr_material ) {

                    // don't copy over unused values to avoid material warning spam
                    const keys = [ 'ambient', 'emission', 'transparent', 'transparency', 'doubleSided' ]

                    switch ( khr_material.technique ) {

                        case 'BLINN' :
                        case 'PHONG' :
                            materialType = THREE.MeshPhongMaterial
                            keys.push( 'diffuse', 'specular', 'shininess' )
                            break

                        case 'LAMBERT' :
                            materialType = THREE.MeshLambertMaterial
                            keys.push( 'diffuse' )
                            break

                        case 'CONSTANT' :
                        default :
                            materialType = THREE.MeshBasicMaterial
                            break

                    }

                    keys.forEach( function ( v ) {

                        if ( khr_material.values[ v ] !== undefined ) materialValues[ v ] = khr_material.values[ v ]

                    } )

                    if ( khr_material.doubleSided || materialValues.doubleSided ) {

                        materialParams.side = THREE.DoubleSide

                    }

                    if ( khr_material.transparent || materialValues.transparent ) {

                        materialParams.transparent = true
                        materialParams.opacity = ( materialValues.transparency !== undefined ) ? materialValues.transparency : 1

                    }

                } else if ( material.technique === undefined ) {

                    materialType = THREE.MeshPhongMaterial

                    Object.assign( materialValues, material.values )

                } else {

                    materialType = DeferredShaderMaterial

                    const technique = json.techniques[ material.technique ]

                    materialParams.uniforms = {}

                    const program = json.programs[ technique.program ]

                    if ( program ) {

                        materialParams.fragmentShader = dependencies.shaders[ program.fragmentShader ]

                        if ( ! materialParams.fragmentShader ) {

                            // Shaders are intentionally skipped since materials get replaced by replaceBrushMaterials()
                            materialType = THREE.MeshPhongMaterial

                        }

                        const vertexShader = dependencies.shaders[ program.vertexShader ]

                        if ( ! vertexShader ) {

                            // Shaders are intentionally skipped since materials get replaced by replaceBrushMaterials()
                            materialType = THREE.MeshPhongMaterial

                        }


                        const uniforms = technique.uniforms

                        for ( const uniformId in uniforms ) {

                            const pname = uniforms[ uniformId ]
                            const shaderParam = technique.parameters[ pname ]

                            const ptype = shaderParam.type

                            if ( WEBGL_TYPE[ ptype ] ) {

                                const pcount = shaderParam.count
                                var value

                                if ( material.values !== undefined ) value = material.values[ pname ]

                                let uvalue = new WEBGL_TYPE[ ptype ]()
                                const usemantic = shaderParam.semantic
                                const unode = shaderParam.node

                                switch ( ptype ) {

                                    case WEBGL_CONSTANTS.FLOAT:

                                        uvalue = shaderParam.value

                                        if ( pname == 'transparency' ) {

                                            materialParams.transparent = true

                                        }

                                        if ( value !== undefined ) {

                                            uvalue = value

                                        }

                                        break

                                    case WEBGL_CONSTANTS.FLOAT_VEC2:
                                    case WEBGL_CONSTANTS.FLOAT_VEC3:
                                    case WEBGL_CONSTANTS.FLOAT_VEC4:
                                    case WEBGL_CONSTANTS.FLOAT_MAT3:

                                        if ( shaderParam && shaderParam.value ) {

                                            uvalue.fromArray( shaderParam.value )

                                        }

                                        if ( value ) {

                                            uvalue.fromArray( value )

                                        }

                                        break

                                    case WEBGL_CONSTANTS.FLOAT_MAT2:

                                        // what to do?
                                        console.warn( 'FLOAT_MAT2 is not a supported uniform type' )
                                        break

                                    case WEBGL_CONSTANTS.FLOAT_MAT4:

                                        if ( pcount ) {

                                            uvalue = new Array( pcount )

                                            for ( let mi = 0; mi < pcount; mi ++ ) {

                                                uvalue[ mi ] = new WEBGL_TYPE[ ptype ]()

                                            }

                                            if ( shaderParam && shaderParam.value ) {

                                                const m4v = shaderParam.value
                                                uvalue.fromArray( m4v )

                                            }

                                            if ( value ) {

                                                uvalue.fromArray( value )

                                            }

                                        } else {

                                            if ( shaderParam && shaderParam.value ) {

                                                const m4 = shaderParam.value
                                                uvalue.fromArray( m4 )

                                            }

                                            if ( value ) {

                                                uvalue.fromArray( value )

                                            }

                                        }

                                        break

                                    case WEBGL_CONSTANTS.SAMPLER_2D:

                                        if ( value !== undefined ) {

                                            uvalue = dependencies.textures[ value ]

                                        } else if ( shaderParam.value !== undefined ) {

                                            uvalue = dependencies.textures[ shaderParam.value ]

                                        } else {

                                            uvalue = null

                                        }

                                        break

                                }

                                materialParams.uniforms[ uniformId ] = {
                                    value: uvalue,
                                    semantic: usemantic,
                                    node: unode
                                }

                            } else {

                                throw new Error( 'Unknown shader uniform param type: ' + ptype )

                            }

                        }

                        const states = technique.states || {}
                        const enables = states.enable || []
                        const functions = states.functions || {}

                        let enableCullFace = false
                        let enableDepthTest = false
                        let enableBlend = false

                        for ( let i = 0, il = enables.length; i < il; i ++ ) {

                            const enable = enables[ i ]

                            switch ( STATES_ENABLES[ enable ] ) {

                                case 'CULL_FACE':

                                    enableCullFace = true

                                    break

                                case 'DEPTH_TEST':

                                    enableDepthTest = true

                                    break

                                case 'BLEND':

                                    enableBlend = true

                                    break

                                // TODO: implement
                                case 'SCISSOR_TEST':
                                case 'POLYGON_OFFSET_FILL':
                                case 'SAMPLE_ALPHA_TO_COVERAGE':

                                    break

                                default:

                                    throw new Error( 'Unknown technique.states.enable: ' + enable )

                            }

                        }

                        if ( enableCullFace ) {

                            materialParams.side = functions.cullFace !== undefined ? WEBGL_SIDES[ functions.cullFace ] : THREE.FrontSide

                        } else {

                            materialParams.side = THREE.DoubleSide

                        }

                        materialParams.depthTest = enableDepthTest
                        materialParams.depthFunc = functions.depthFunc !== undefined ? WEBGL_DEPTH_FUNCS[ functions.depthFunc ] : THREE.LessDepth
                        materialParams.depthWrite = functions.depthMask !== undefined ? functions.depthMask[ 0 ] : true

                        materialParams.blending = enableBlend ? THREE.CustomBlending : THREE.NoBlending
                        materialParams.transparent = enableBlend

                        const blendEquationSeparate = functions.blendEquationSeparate

                        if ( blendEquationSeparate !== undefined ) {

                            materialParams.blendEquation = WEBGL_BLEND_EQUATIONS[ blendEquationSeparate[ 0 ] ]
                            materialParams.blendEquationAlpha = WEBGL_BLEND_EQUATIONS[ blendEquationSeparate[ 1 ] ]

                        } else {

                            materialParams.blendEquation = THREE.AddEquation
                            materialParams.blendEquationAlpha = THREE.AddEquation

                        }

                        const blendFuncSeparate = functions.blendFuncSeparate

                        if ( blendFuncSeparate !== undefined ) {

                            materialParams.blendSrc = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 0 ] ]
                            materialParams.blendDst = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 1 ] ]
                            materialParams.blendSrcAlpha = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 2 ] ]
                            materialParams.blendDstAlpha = WEBGL_BLEND_FUNCS[ blendFuncSeparate[ 3 ] ]

                        } else {

                            materialParams.blendSrc = THREE.OneFactor
                            materialParams.blendDst = THREE.ZeroFactor
                            materialParams.blendSrcAlpha = THREE.OneFactor
                            materialParams.blendDstAlpha = THREE.ZeroFactor

                        }

                    }

                }

                if ( Array.isArray( materialValues.diffuse ) ) {

                    materialParams.color = new THREE.Color().fromArray( materialValues.diffuse )

                } else if ( typeof ( materialValues.diffuse ) === 'string' ) {

                    materialParams.map = dependencies.textures[ materialValues.diffuse ]

                }

                delete materialParams.diffuse

                if ( typeof ( materialValues.reflective ) === 'string' ) {

                    materialParams.envMap = dependencies.textures[ materialValues.reflective ]

                }

                if ( typeof ( materialValues.bump ) === 'string' ) {

                    materialParams.bumpMap = dependencies.textures[ materialValues.bump ]

                }

                if ( Array.isArray( materialValues.emission ) ) {

                    if ( materialType === THREE.MeshBasicMaterial ) {

                        materialParams.color = new THREE.Color().fromArray( materialValues.emission )

                    } else {

                        materialParams.emissive = new THREE.Color().fromArray( materialValues.emission )

                    }

                } else if ( typeof ( materialValues.emission ) === 'string' ) {

                    if ( materialType === THREE.MeshBasicMaterial ) {

                        materialParams.map = dependencies.textures[ materialValues.emission ]

                    } else {

                        materialParams.emissiveMap = dependencies.textures[ materialValues.emission ]

                    }

                }

                if ( Array.isArray( materialValues.specular ) ) {

                    materialParams.specular = new THREE.Color().fromArray( materialValues.specular )

                } else if ( typeof ( materialValues.specular ) === 'string' ) {

                    materialParams.specularMap = dependencies.textures[ materialValues.specular ]

                }

                if ( materialValues.shininess !== undefined ) {

                    materialParams.shininess = materialValues.shininess

                }

                // MeshPhongMaterial (and other built-ins) reject shader-only params.
                // When shaders are skipped and we fall back from DeferredShaderMaterial,
                // strip these so THREE.Material doesn't warn about unknown properties.
                // Keep a copy: PbrTemplate BaseColorTex / factors must survive for replaceMaterial.
                const pendingUniforms = materialParams.uniforms
                if (materialType !== DeferredShaderMaterial) {
                    if (pendingUniforms?.u_BaseColorTex?.value?.isTexture) {
                        materialParams.map = pendingUniforms.u_BaseColorTex.value
                    }
                    delete materialParams.uniforms
                    delete materialParams.fragmentShader
                    delete materialParams.vertexShader
                }

                const _material = new materialType(materialParams)
                if (material.name !== undefined) (_material as THREE.Material).name = material.name

                // Phong fallback has no .uniforms; reattach so PBR replaceMaterial can read them.
                if (materialType !== DeferredShaderMaterial && pendingUniforms) {
                    (_material as AnyDict).uniforms = pendingUniforms;
                    (_material as THREE.Material).userData.tiltGltfUniforms = pendingUniforms
                }

                return _material

            } )

        } )

    }

    loadMeshes() {

        const json = this.json

        return this._withDependencies( [

            'accessors',
            'materials'

        ] ).then( function ( dependencies ) {

            return _each( json.meshes, function ( mesh ) {

                const group = new THREE.Group()
                if ( mesh.name !== undefined ) group.name = mesh.name

                if ( mesh.extras ) group.userData = mesh.extras

                const primitives = mesh.primitives || []

                for ( const name in primitives ) {

                    const primitive = primitives[ name ]

                    if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === undefined ) {

                        var geometry: THREE.BufferGeometry = new THREE.BufferGeometry()

                        var attributes: AnyDict = primitive.attributes

                        for ( var attributeId in attributes ) {

                            var attributeEntry = attributes[ attributeId ]

                            if ( ! attributeEntry ) return

                            var bufferAttribute = dependencies.accessors[ attributeEntry ]

                            switch ( attributeId ) {

                                case 'POSITION':
                                    geometry.setAttribute( 'position', bufferAttribute )
                                    break

                                case 'NORMAL':
                                    geometry.setAttribute( 'normal', bufferAttribute )
                                    break

                                case 'TEXCOORD_0':
                                case 'TEXCOORD0':
                                case 'TEXCOORD':
                                    geometry.setAttribute( 'uv', bufferAttribute )
                                    break

                                case 'TEXCOORD_1':
                                    geometry.setAttribute( 'uv2', bufferAttribute )
                                    break

                                case 'COLOR_0':
                                case 'COLOR0':
                                case 'COLOR':
                                    geometry.setAttribute( 'color', bufferAttribute )
                                    break

                                case 'WEIGHT':
                                    geometry.setAttribute( 'skinWeight', bufferAttribute )
                                    break

                                case 'JOINT':
                                    geometry.setAttribute( 'skinIndex', bufferAttribute )
                                    break

                                default:

                                    if ( ! primitive.material ) break

                                    var material = json.materials[ primitive.material ]

                                    if ( ! material.technique ) break

                                    var parameters = json.techniques[ material.technique ].parameters || {}

                                    for ( const attributeName in parameters ) {

                                        if ( parameters[ attributeName ][ 'semantic' ] === attributeId ) {

                                            geometry.setAttribute( attributeName, bufferAttribute )

                                        }

                                    }

                            }

                        }

                        if ( primitive.indices ) {

                            geometry.setIndex( dependencies.accessors[ primitive.indices ] )

                        }

                        var material = dependencies.materials !== undefined ? dependencies.materials[ primitive.material ] : createDefaultMaterial()

                        var meshNode: any = new THREE.Mesh( geometry, material )
                        meshNode.castShadow = true
                        meshNode.name = ( name === '0' ? group.name : group.name + name )

                        if ( primitive.extras ) meshNode.userData = primitive.extras

                        group.add( meshNode )

                    } else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

                        geometry = new THREE.BufferGeometry()

                        attributes = primitive.attributes

                        for ( var attributeId in attributes ) {

                            var attributeEntry = attributes[ attributeId ]

                            if ( ! attributeEntry ) return

                            var bufferAttribute = dependencies.accessors[ attributeEntry ]

                            switch ( attributeId ) {

                                case 'POSITION':
                                    geometry.setAttribute( 'position', bufferAttribute )
                                    break

                                case 'COLOR_0':
                                case 'COLOR0':
                                case 'COLOR':
                                    geometry.setAttribute( 'color', bufferAttribute )
                                    break

                            }

                        }

                        var material = dependencies.materials[ primitive.material ]

                        var meshNode: any

                        if ( primitive.indices ) {

                            geometry.setIndex( dependencies.accessors[ primitive.indices ] )

                            meshNode = new THREE.LineSegments( geometry, material )

                        } else {

                            meshNode = new THREE.Line( geometry, material )

                        }

                        meshNode.name = ( name === '0' ? group.name : group.name + name )

                        if ( primitive.extras ) meshNode.userData = primitive.extras

                        group.add( meshNode )

                    } else {

                        console.warn( 'Only triangular and line primitives are supported' )

                    }

                }

                return group

            } )

        } )

    }

    loadCameras() {

        const json = this.json

        return _each( json.cameras, function ( camera ) {

            let _camera: THREE.Camera

            if ( camera.type == 'perspective' && camera.perspective ) {

                const yfov = camera.perspective.yfov
                const aspectRatio = camera.perspective.aspectRatio !== undefined ? camera.perspective.aspectRatio : 1

                // According to COLLADA spec...
                // aspectRatio = xfov / yfov
                const xfov = yfov * aspectRatio

                _camera = new THREE.PerspectiveCamera( THREE.MathUtils.radToDeg( xfov ), aspectRatio, camera.perspective.znear || 1, camera.perspective.zfar || 2e6 )
                if ( camera.name !== undefined ) _camera.name = camera.name

                if ( camera.extras ) _camera.userData = camera.extras

                return _camera

            } else if ( camera.type == 'orthographic' && camera.orthographic ) {

                _camera = new THREE.OrthographicCamera( window.innerWidth / - 2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / - 2, camera.orthographic.znear, camera.orthographic.zfar )
                if ( camera.name !== undefined ) _camera.name = camera.name

                if ( camera.extras ) _camera.userData = camera.extras

                return _camera

            }

        } )

    }

    loadSkins() {

        const json = this.json

        return this._withDependencies( [

            'accessors'

        ] ).then( function ( dependencies ) {

            return _each( json.skins, function ( skin ) {

                const bindShapeMatrix = new THREE.Matrix4()

                if ( skin.bindShapeMatrix !== undefined ) bindShapeMatrix.fromArray( skin.bindShapeMatrix )

                const _skin = {
                    bindShapeMatrix: bindShapeMatrix,
                    jointNames: skin.jointNames,
                    inverseBindMatrices: dependencies.accessors[ skin.inverseBindMatrices ]
                }

                return _skin

            } )

        } )

    }

    loadAnimations() {

        const json = this.json

        return this._withDependencies( [

            'accessors',
            'nodes'

        ] ).then( function ( dependencies ) {

            return _each( json.animations, function ( animation, animationId ) {

                const tracks = []

                for ( const channelId in animation.channels ) {

                    const channel = animation.channels[ channelId ]
                    const sampler = animation.samplers[ channel.sampler ]

                    if ( sampler ) {

                        const target = channel.target
                        var name = target.id
                        const input = animation.parameters !== undefined ? animation.parameters[ sampler.input ] : sampler.input
                        const output = animation.parameters !== undefined ? animation.parameters[ sampler.output ] : sampler.output

                        const inputAccessor = dependencies.accessors[ input ]
                        const outputAccessor = dependencies.accessors[ output ]

                        const node = dependencies.nodes[ name ]

                        if ( node ) {

                            node.updateMatrix()
                            node.matrixAutoUpdate = true

                            const TypedKeyframeTrack = PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.rotation
                                ? THREE.QuaternionKeyframeTrack
                                : THREE.VectorKeyframeTrack

                            const targetName = node.name ? node.name : node.uuid
                            const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear

                            // KeyframeTrack.optimize() will modify given 'times' and 'values'
                            // buffers before creating a truncated copy to keep. Because buffers may
                            // be reused by other tracks, make copies here.
                            tracks.push( new TypedKeyframeTrack(
                                targetName + '.' + PATH_PROPERTIES[ target.path ],
                                Array.prototype.slice.call( inputAccessor.array ),
                                Array.prototype.slice.call( outputAccessor.array ),
                                interpolation
                            ) )

                        }

                    }

                }

                var name = animation.name !== undefined ? animation.name : 'animation_' + animationId

                return new THREE.AnimationClip( name, undefined, tracks )

            } )

        } )

    }

    loadNodes() {

        const json = this.json
        const extensions = this.extensions
        const scope = this

        return _each( json.nodes, function ( node ) {

            const matrix = new THREE.Matrix4()

            let _node

            if ( node.jointName ) {

                _node = new THREE.Bone()
                _node.name = node.name !== undefined ? node.name : node.jointName;
                (_node as any).jointName = node.jointName

            } else {

                _node = new THREE.Object3D()
                if ( node.name !== undefined ) _node.name = node.name

            }

            if ( node.extras ) _node.userData = node.extras

            if ( node.matrix !== undefined ) {

                matrix.fromArray( node.matrix )
                _node.applyMatrix4( matrix )

            } else {

                if ( node.translation !== undefined ) {

                    _node.position.fromArray( node.translation )

                }

                if ( node.rotation !== undefined ) {

                    _node.quaternion.fromArray( node.rotation )

                }

                if ( node.scale !== undefined ) {

                    _node.scale.fromArray( node.scale )

                }

            }

            return _node

        } ).then( function ( __nodes ) {

            return scope._withDependencies( [

                'meshes',
                'skins',
                'cameras'

            ] ).then( function ( dependencies ) {

                return _each( __nodes, function ( _node, nodeId ) {

                    const node = json.nodes[ nodeId ]

                    if ( node.meshes !== undefined ) {

                        for ( const meshId in node.meshes ) {

                            const mesh = node.meshes[ meshId ]
                            const group = dependencies.meshes[ mesh ]

                            if ( group === undefined ) {

                                console.warn( 'LegacyGLTFLoader: Couldn\'t find node "' + mesh + '".' )
                                continue

                            }

                            for ( const childrenId in group.children ) {

                                let child = group.children[ childrenId ]

                                // clone Mesh to add to _node

                                let originalMaterial = child.material
                                const originalGeometry = child.geometry
                                const originalUserData = child.userData
                                const originalName = child.name

                                var material

                                if ( originalMaterial.isDeferredShaderMaterial ) {

                                    originalMaterial = material = originalMaterial.create()

                                } else {

                                    material = originalMaterial

                                }

                                switch ( child.type ) {

                                    case 'LineSegments':
                                        child = new THREE.LineSegments( originalGeometry, material )
                                        break

                                    case 'LineLoop':
                                        child = new THREE.LineLoop( originalGeometry, material )
                                        break

                                    case 'Line':
                                        child = new THREE.Line( originalGeometry, material )
                                        break

                                    default:
                                        child = new THREE.Mesh( originalGeometry, material )

                                }

                                child.castShadow = true
                                child.userData = originalUserData
                                child.name = originalName

                                var skinEntry

                                if ( node.skin ) {

                                    skinEntry = dependencies.skins[ node.skin ]

                                }

                                // Replace Mesh with SkinnedMesh in library
                                if ( skinEntry ) {

                                    const getJointNode = function ( jointId: any ) {

                                        const keys = Object.keys( __nodes )

                                        for ( let i = 0, il = keys.length; i < il; i ++ ) {

                                            const n = __nodes[ keys[ i ] ]

                                            if ( n.jointName === jointId ) return n

                                        }

                                        return null

                                    }

                                    const geometry = originalGeometry
                                    var material = originalMaterial
                                    material.skinning = true

                                    child = new THREE.SkinnedMesh( geometry, material )
                                    child.castShadow = true
                                    child.userData = originalUserData
                                    child.name = originalName

                                    const bones = []
                                    const boneInverses = []

                                    for ( let i = 0, l = skinEntry.jointNames.length; i < l; i ++ ) {

                                        const jointId = skinEntry.jointNames[ i ]
                                        const jointNode = getJointNode( jointId )

                                        if ( jointNode ) {

                                            bones.push( jointNode )

                                            const m = skinEntry.inverseBindMatrices.array
                                            const mat = new THREE.Matrix4().fromArray( m, i * 16 )
                                            boneInverses.push( mat )

                                        } else {

                                            console.warn( 'WARNING: joint: \'' + jointId + '\' could not be found' )

                                        }

                                    }

                                    child.bind( new THREE.Skeleton( bones, boneInverses ), skinEntry.bindShapeMatrix )

                                    var buildBoneGraph = function ( parentJson: any, parentObject: any, property: any ) {

                                        const children = parentJson[ property ]

                                        if ( children === undefined ) return

                                        for ( let i = 0, il = children.length; i < il; i ++ ) {

                                            const nodeId = children[ i ]
                                            const bone = __nodes[ nodeId ]
                                            const boneJson = json.nodes[ nodeId ]

                                            if ( bone !== undefined && bone.isBone === true && boneJson !== undefined ) {

                                                parentObject.add( bone )
                                                buildBoneGraph( boneJson, bone, 'children' )

                                            }

                                        }

                                    }

                                    buildBoneGraph( node, child, 'skeletons' )

                                }

                                _node.add( child )

                            }

                        }

                    }

                    if ( node.camera !== undefined ) {

                        const camera = dependencies.cameras[ node.camera ]

                        _node.add( camera )

                    }

                    if ( node.extensions
                        && node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ]
                        && node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].light ) {

                        const extensionLights = extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].lights
                        const light = extensionLights[ node.extensions[ EXTENSIONS.KHR_MATERIALS_COMMON ].light ]

                        _node.add( light )

                    }

                    return _node

                } )

            } )

        } )

    }

    loadScenes() {

        const json = this.json

        // scene node hierachy builder

        function buildNodeHierachy( nodeId: any, parentObject: any, allNodes: any ) {

            const _node = allNodes[ nodeId ]
            parentObject.add( _node )

            const node = json.nodes[ nodeId ]

            if ( node.children ) {

                const children = node.children

                for ( let i = 0, l = children.length; i < l; i ++ ) {

                    const child = children[ i ]
                    buildNodeHierachy( child, _node, allNodes )

                }

            }

        }

        return this._withDependencies( [

            'nodes'

        ] ).then( function ( dependencies ) {

            return _each( json.scenes, function ( scene ) {

                const _scene = new THREE.Scene()
                if ( scene.name !== undefined ) _scene.name = scene.name

                if ( scene.extras ) _scene.userData = scene.extras

                const nodes = scene.nodes || []

                for ( let i = 0, l = nodes.length; i < l; i ++ ) {

                    const nodeId = nodes[ i ]
                    buildNodeHierachy( nodeId, _scene, dependencies.nodes )

                }

                _scene.traverse( function ( child ) {

                    // Register raw material meshes with LegacyGLTFLoader.Shaders
                    const meshChild = child as any
                    if ( meshChild.material && meshChild.material.isRawShaderMaterial ) {

                        meshChild.gltfShader = new GLTFShader( meshChild, dependencies.nodes )
                        meshChild.onBeforeRender = function ( this: any, _renderer: unknown, scene: THREE.Scene, camera: THREE.Camera ) {

                            this.gltfShader.update( scene, camera )

                        }

                    }

                } )

                return _scene

            } )

        } )

    }
}
