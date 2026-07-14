import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

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

// Stages in ascending rank order; index 0 → rank 1.
export const STATUS_SEQUENCE: readonly OrderStatus[] = [
  'Ordered',
  'OnTheWay',
  'Delivered',
  'AtOffice',
  'WithMe'
]

export function rankOf(status: OrderStatus): number {
  return STATUS_SEQUENCE.indexOf(status) + 1
}

export function statusOfRank(rank: number): OrderStatus {
  const status = STATUS_SEQUENCE[rank - 1]
  if (!status) throw new RangeError(`invalid status rank: ${rank}`)
  return status
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

// Fields a user may edit by hand. Status is intentionally excluded — it only
// changes through the forward-only methods below.
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

const CURRENT_VERSION = 1

interface PersistedState {
  version: number
  orders: Order[]
  lastProcessedEmailTimestamp: string | null
}

function emptyState(): PersistedState {
  return { version: CURRENT_VERSION, orders: [], lastProcessedEmailTimestamp: null }
}

/**
 * Owns all persisted order data. Loads from disk on construction and writes
 * back on every mutation, so state survives quit/reopen. A missing, empty, or
 * corrupt file is treated as an empty state — never a crash.
 */
export class OrderStore {
  private readonly filePath: string
  private state: PersistedState

  constructor(filePath: string) {
    this.filePath = filePath
    this.state = this.load()
  }

  private load(): PersistedState {
    try {
      if (!existsSync(this.filePath)) return emptyState()
      const raw = readFileSync(this.filePath, 'utf-8').trim()
      if (!raw) return emptyState()
      const parsed = JSON.parse(raw) as Partial<PersistedState>
      return {
        version: parsed.version ?? CURRENT_VERSION,
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        lastProcessedEmailTimestamp: parsed.lastProcessedEmailTimestamp ?? null
      }
    } catch {
      return emptyState()
    }
  }

  // Atomic write: write to a temp file then rename, so a crash mid-write can't
  // leave a half-written orders.json behind.
  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf-8')
    renameSync(tmp, this.filePath)
  }

  private now(): string {
    return new Date().toISOString()
  }

  // Return copies so callers can't mutate internal state directly.
  getOrders(): Order[] {
    return this.state.orders.map((o) => ({ ...o }))
  }

  getOrder(id: string): Order | undefined {
    const found = this.state.orders.find((o) => o.id === id)
    return found ? { ...found } : undefined
  }

  addOrder(input: NewOrderInput): Order {
    const status = input.status ?? 'Ordered'
    const ts = this.now()
    const order: Order = {
      id: randomUUID(),
      title: input.title,
      source: input.source,
      status,
      statusRank: rankOf(status),
      orderNumber: input.orderNumber,
      trackingNumber: input.trackingNumber,
      orderedDate: input.orderedDate ?? ts,
      expectedDate: input.expectedDate,
      lastUpdated: ts,
      notes: input.notes,
      sourceEmailId: input.sourceEmailId
    }
    this.state.orders.push(order)
    this.persist()
    return { ...order }
  }

  updateOrder(id: string, patch: OrderPatch): Order | undefined {
    const order = this.state.orders.find((o) => o.id === id)
    if (!order) return undefined
    if (patch.title !== undefined) order.title = patch.title
    if (patch.source !== undefined) order.source = patch.source
    if (patch.orderNumber !== undefined) order.orderNumber = patch.orderNumber
    if (patch.trackingNumber !== undefined) order.trackingNumber = patch.trackingNumber
    if (patch.expectedDate !== undefined) order.expectedDate = patch.expectedDate
    if (patch.notes !== undefined) order.notes = patch.notes
    order.lastUpdated = this.now()
    this.persist()
    return { ...order }
  }

  /**
   * Forward-only status change. Applies `status` only if its rank is strictly
   * higher than the order's current rank; a lower or equal rank is ignored.
   * This single rule neutralizes duplicate, out-of-order, and promo emails.
   */
  applyStatus(id: string, status: OrderStatus, sourceEmailId?: string): StatusChange {
    const order = this.state.orders.find((o) => o.id === id)
    if (!order) return { applied: false }
    const newRank = rankOf(status)
    if (newRank <= order.statusRank) {
      return { order: { ...order }, applied: false }
    }
    order.status = status
    order.statusRank = newRank
    order.lastUpdated = this.now()
    if (sourceEmailId !== undefined) order.sourceEmailId = sourceEmailId
    this.persist()
    return { order: { ...order }, applied: true }
  }

  // Manual "advance" button: move exactly one stage forward. No-op at 'WithMe'.
  advanceStatus(id: string): StatusChange {
    const order = this.state.orders.find((o) => o.id === id)
    if (!order) return { applied: false }
    if (order.statusRank >= STATUS_SEQUENCE.length) {
      return { order: { ...order }, applied: false }
    }
    return this.applyStatus(id, statusOfRank(order.statusRank + 1))
  }

  removeOrder(id: string): boolean {
    const before = this.state.orders.length
    this.state.orders = this.state.orders.filter((o) => o.id !== id)
    const removed = this.state.orders.length !== before
    if (removed) this.persist()
    return removed
  }

  // Delete only picked-up (WithMe) orders — the archive that grows over time.
  clearPickedUp(): number {
    const before = this.state.orders.length
    this.state.orders = this.state.orders.filter((o) => o.status !== 'WithMe')
    const removed = before - this.state.orders.length
    if (removed) this.persist()
    return removed
  }

  resetAll(): void {
    this.state = emptyState()
    this.persist()
  }

  getLastProcessedEmailTimestamp(): string | null {
    return this.state.lastProcessedEmailTimestamp
  }

  setLastProcessedEmailTimestamp(value: string | null): void {
    this.state.lastProcessedEmailTimestamp = value
    this.persist()
  }
}
