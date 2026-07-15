import { Storage as $ } from '@io-gui/core'

export const $GUID = $({ key: 'guid', storage: 'hash', value: '' })
export const $PAGE = $({ key: 'page', storage: 'hash', value: 'catalog' })
export const $FILTER = $({ key: 'filter', storage: 'hash', value: '' })
export const $SIZE = $({ key: 'size', storage: 'hash', value: '128' })
