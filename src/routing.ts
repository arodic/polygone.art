import { Storage as $ } from '@io-gui/core'

export const $PAGE = $({ key: 'page', storage: 'hash', value: 'about' })
export const $FILTER = $({ key: 'filter', storage: 'hash', value: '' })
export const $TYPE = $({ key: 'type', storage: 'hash', value: 'all' })
export const $SIZE = $({ key: 'size', storage: 'hash', value: '128' })
