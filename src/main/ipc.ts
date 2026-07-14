import { ipcMain } from 'electron'
import type { OrderStore } from './store'
import type { NewOrderInput, OrderPatch } from '../shared/types'

// Wire the renderer's window.otway calls to the store. `onChange` runs after
// every mutation so the caller can react (e.g. refresh the tray count badge).
export function registerOrderIpc(store: OrderStore, onChange: () => void): void {
  ipcMain.handle('orders:list', () => store.getOrders())

  ipcMain.handle('orders:add', (_event, input: NewOrderInput) => {
    const order = store.addOrder(input)
    onChange()
    return order
  })

  ipcMain.handle('orders:update', (_event, id: string, patch: OrderPatch) => {
    const order = store.updateOrder(id, patch) ?? null
    onChange()
    return order
  })

  ipcMain.handle('orders:advance', (_event, id: string) => {
    const result = store.advanceStatus(id)
    onChange()
    return result
  })

  ipcMain.handle('orders:remove', (_event, id: string) => {
    const removed = store.removeOrder(id)
    onChange()
    return removed
  })

  ipcMain.handle('orders:clearPickedUp', () => {
    const count = store.clearPickedUp()
    onChange()
    return count
  })

  ipcMain.handle('orders:resetAll', () => {
    store.resetAll()
    onChange()
  })
}
