// Shared across main, preload, and renderer so all three agree on the Order
// shape and the status pipeline. No Node/Electron imports — safe in the browser.

// The five pipeline stages (PRD §3.1). Status can only ever advance.
export type OrderStatus = 'Ordered' | 'OnTheWay' | 'Delivered' | 'AtOffice' | 'WithMe'

export interface Order {
  id: string
  title: string
  source: string
  status: OrderStatus
  statusRank: number
  orderNumber?: string
  trackingNumber?: string
  orderedDate: string // ISO 8601
  expectedDate?: string // ISO 8601
  lastUpdated: string // ISO 8601
  notes?: string
  sourceEmailId?: string // Gmail message id that last updated it
}

export interface NewOrderInput {
  title: string
  source: string
  status?: OrderStatus // defaults to 'Ordered'
  orderNumber?: string
  trackingNumber?: string
  orderedDate?: string
  expectedDate?: string
  notes?: string
  sourceEmailId?: string
}

// Fields a user may edit by hand. Status is excluded — it only changes through
// the forward-only advance/applyStatus paths.
export interface OrderPatch {
  title?: string
  source?: string
  orderNumber?: string
  trackingNumber?: string
  expectedDate?: string
  notes?: string
}

export interface StatusChange {
  order?: Order
  applied: boolean
}

// Gmail connection state surfaced to the renderer.
export interface GmailStatus {
  connected: boolean
  error?: string
}

// Stages in ascending rank order; index 0 → rank 1.
export const STATUS_SEQUENCE: readonly OrderStatus[] = [
  'Ordered',
  'OnTheWay',
  'Delivered',
  'AtOffice',
  'WithMe'
]

// Display labels for the UI (the enum values are terse on purpose).
export const STATUS_META: Record<OrderStatus, { label: string }> = {
  Ordered: { label: 'Ordered' },
  OnTheWay: { label: 'On the way' },
  Delivered: { label: 'Delivered' },
  AtOffice: { label: 'At office' },
  WithMe: { label: 'With me' }
}

export function rankOf(status: OrderStatus): number {
  return STATUS_SEQUENCE.indexOf(status) + 1
}

export function statusOfRank(rank: number): OrderStatus {
  const status = STATUS_SEQUENCE[rank - 1]
  if (!status) throw new RangeError(`invalid status rank: ${rank}`)
  return status
}
