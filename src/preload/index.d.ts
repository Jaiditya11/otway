import { ElectronAPI } from '@electron-toolkit/preload'
import type { GmailStatus, NewOrderInput, Order, OrderPatch, StatusChange } from '../shared/types'

export interface OtwayApi {
  list: () => Promise<Order[]>
  add: (input: NewOrderInput) => Promise<Order>
  update: (id: string, patch: OrderPatch) => Promise<Order | null>
  advance: (id: string) => Promise<StatusChange>
  remove: (id: string) => Promise<boolean>
  clearPickedUp: () => Promise<number>
  resetAll: () => Promise<void>
  gmail: {
    status: () => Promise<GmailStatus>
    connect: () => Promise<GmailStatus>
    disconnect: () => Promise<GmailStatus>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    otway: OtwayApi
  }
}
