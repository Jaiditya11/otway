import { ElectronAPI } from '@electron-toolkit/preload'
import type { NewOrderInput, Order, OrderPatch, StatusChange } from '../shared/types'

export interface OtwayApi {
  list: () => Promise<Order[]>
  add: (input: NewOrderInput) => Promise<Order>
  update: (id: string, patch: OrderPatch) => Promise<Order | null>
  advance: (id: string) => Promise<StatusChange>
  remove: (id: string) => Promise<boolean>
  clearPickedUp: () => Promise<number>
  resetAll: () => Promise<void>
}

declare global {
  interface Window {
    electron: ElectronAPI
    otway: OtwayApi
  }
}
