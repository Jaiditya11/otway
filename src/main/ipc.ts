import { ipcMain } from 'electron'
import type { OrderStore } from './store'
import type { NewOrderInput, OrderPatch } from '../shared/types'

// Wire the renderer's window.otway calls to the store. Each channel maps 1:1
// to a store method; mutations return enough for the renderer to refresh.
export function registerOrderIpc(store: OrderStore): void {
  ipcMain.handle('orders:list', () => store.getOrders())
  ipcMain.handle('orders:add', (_event, input: NewOrderInput) => store.addOrder(input))
  ipcMain.handle('orders:update', (_event, id: string, patch: OrderPatch) => {
    return store.updateOrder(id, patch) ?? null
  })
  ipcMain.handle('orders:advance', (_event, id: string) => store.advanceStatus(id))
  ipcMain.handle('orders:remove', (_event, id: string) => store.removeOrder(id))
}
