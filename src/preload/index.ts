import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { NewOrderInput, Order, OrderPatch, StatusChange } from '../shared/types'

// Otway's order API, exposed to the renderer as window.otway.
const otway = {
  list: (): Promise<Order[]> => ipcRenderer.invoke('orders:list'),
  add: (input: NewOrderInput): Promise<Order> => ipcRenderer.invoke('orders:add', input),
  update: (id: string, patch: OrderPatch): Promise<Order | null> =>
    ipcRenderer.invoke('orders:update', id, patch),
  advance: (id: string): Promise<StatusChange> => ipcRenderer.invoke('orders:advance', id),
  remove: (id: string): Promise<boolean> => ipcRenderer.invoke('orders:remove', id),
  clearPickedUp: (): Promise<number> => ipcRenderer.invoke('orders:clearPickedUp'),
  resetAll: (): Promise<void> => ipcRenderer.invoke('orders:resetAll')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('otway', otway)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.otway = otway
}
