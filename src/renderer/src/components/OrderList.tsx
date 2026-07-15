import { useState } from 'react'
import type { Order, OrderStatus } from '../../../shared/types'
import { STATUS_META } from '../../../shared/types'

interface Props {
  orders: Order[]
  statuses: readonly OrderStatus[]
  emptyText: string
  onAdvance: (id: string) => void
  onEdit: (order: Order) => void
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function OrderList({
  orders,
  statuses,
  emptyText,
  onAdvance,
  onEdit,
  onDelete
}: Props): React.JSX.Element {
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const visible = orders.filter((o) => statuses.includes(o.status))
  if (visible.length === 0) {
    return (
      <div className="empty">
        <div className="empty__icon">📦</div>
        <p className="empty__text">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="list">
      {statuses.map((status) => {
        const group = visible.filter((o) => o.status === status)
        if (group.length === 0) return null
        return (
          <section key={status} className="group">
            <h2 className="group__header">
              <span className={`dot dot--${status}`} />
              {STATUS_META[status].label}
              <span className="group__count">{group.length}</span>
            </h2>
            {group.map((order) => (
              <div key={order.id} className="row">
                <div className="row__main">
                  <div className="row__title">{order.title}</div>
                  <div className="row__meta">
                    {order.source}
                    {order.expectedDate ? ` · exp. ${formatDate(order.expectedDate)}` : ''}
                  </div>
                </div>
                {confirmId === order.id ? (
                  <div className="row__actions row__actions--confirm">
                    <button
                      className="btn btn--danger btn--small"
                      onClick={() => {
                        onDelete(order.id)
                        setConfirmId(null)
                      }}
                    >
                      Delete
                    </button>
                    <button className="btn btn--small" onClick={() => setConfirmId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="row__actions">
                    {order.status !== 'WithMe' && (
                      <button
                        className="icon-btn"
                        title="Advance to next stage"
                        onClick={() => onAdvance(order.id)}
                      >
                        →
                      </button>
                    )}
                    <button className="icon-btn" title="Edit" onClick={() => onEdit(order)}>
                      ✎
                    </button>
                    <button
                      className="icon-btn"
                      title="Delete"
                      onClick={() => setConfirmId(order.id)}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}

export default OrderList
