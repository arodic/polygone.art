import {IoStorageFactory as $} from "./iogui.js";

export const $PAGE = $({key: 'page', storage: 'hash', value: 'catalog'})
export const $TYPE = $({key: 'type', storage: 'hash', value: 'all'})
export const $SIZE = $({key: 'size', storage: 'hash', value: '128x128'})
export const $FILTER = $({key: 'filter', value: ''})
export const $GUID = $({key: 'guid', storage: 'hash', value: ''})

export const BLOB_URL = "https://blob.polygone.art"