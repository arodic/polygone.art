import { Property, ReactiveObject, Register } from '@io-gui/core'

export type BottomDrawerData = {
  drawerSize?: string
}

@Register
export class BottomDrawer extends ReactiveObject {

  @Property({ type: String, value: '330px' })
  declare drawerSize: string

  constructor(data: BottomDrawerData = {}) {
    super()
    if (data.drawerSize !== undefined) {
      this.drawerSize = data.drawerSize
    }
  }

}
