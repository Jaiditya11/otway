import { useCallback, useEffect, useState } from 'react'
import type { Order, OrderStatus } from '../../shared/types'
import OrderForm, { type OrderFormValues } from './components/OrderForm'
import OrderList from './components/OrderList'
import ManageData from './components/ManageData'
import Settings from './components/Settings'

type View =
  { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; order: Order } | { mode: 'settings' }
type Tab = 'active' | 'pickedup'

// Active = anything not yet with you (stages 1–4); Picked up = the stage-5 archive.
const ACTIVE_STATUSES: readonly OrderStatus[] = ['Ordered', 'OnTheWay', 'Delivered', 'AtOffice']
const PICKEDUP_STATUSES: readonly OrderStatus[] = ['WithMe']

function App(): React.JSX.Element {
  const [orders, setOrders] = useState<Order[]>([])
  const [view, setView] = useState<View>({ mode: 'list' })
  const [tab, setTab] = useState<Tab>('active')

  const refresh = useCallback(async (): Promise<void> => {
    setOrders(await window.otway.list())
  }, [])

  useEffect(() => {
    // Load on mount, and re-sync whenever the popover regains focus (e.g.
    // reopened from the tray). setState happens in the promise callback.
    const sync = (): void => void window.otway.list().then(setOrders)
    sync()
    window.addEventListener('focus', sync)
    return () => window.removeEventListener('focus', sync)
  }, [])

  const handleSave = useCallback(
    async (values: OrderFormValues): Promise<void> => {
      if (view.mode === 'edit') {
        await window.otway.update(view.order.id, values)
      } else {
        await window.otway.add(values)
      }
      await refresh()
      setView({ mode: 'list' })
    },
    [view, refresh]
  )

  const handleAdvance = useCallback(
    async (id: string): Promise<void> => {
      await window.otway.advance(id)
      await refresh()
    },
    [refresh]
  )

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      await window.otway.remove(id)
      await refresh()
    },
    [refresh]
  )

  const handleClearPickedUp = useCallback(async (): Promise<void> => {
    await window.otway.clearPickedUp()
    await refresh()
  }, [refresh])

  const handleResetAll = useCallback(async (): Promise<void> => {
    await window.otway.resetAll()
    await refresh()
  }, [refresh])

  const pickedUpCount = orders.filter((o) => o.status === 'WithMe').length

  if (view.mode === 'settings') {
    return (
      <div className="panel">
        <header className="panel__header">
          <span className="panel__title">Settings</span>
        </header>
        <main className="panel__body">
          <Settings onClose={() => setView({ mode: 'list' })} />
        </main>
      </div>
    )
  }

  if (view.mode === 'add' || view.mode === 'edit') {
    return (
      <div className="panel">
        <header className="panel__header">
          <span className="panel__title">{view.mode === 'edit' ? 'Edit order' : 'Add order'}</span>
        </header>
        <main className="panel__body">
          <OrderForm
            initial={view.mode === 'edit' ? view.order : undefined}
            onSave={handleSave}
            onCancel={() => setView({ mode: 'list' })}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="panel">
      <header className="panel__header">
        <span className="panel__title">Otway</span>
        <div className="panel__actions">
          <button
            className="icon-btn"
            title="Settings"
            onClick={() => setView({ mode: 'settings' })}
          >
            ⚙
          </button>
          <button
            className="icon-btn icon-btn--add"
            title="Add order"
            onClick={() => setView({ mode: 'add' })}
          >
            +
          </button>
        </div>
      </header>
      <nav className="tabs">
        <button
          className={`tab ${tab === 'active' ? 'tab--active' : ''}`}
          onClick={() => setTab('active')}
        >
          Active
        </button>
        <button
          className={`tab ${tab === 'pickedup' ? 'tab--active' : ''}`}
          onClick={() => setTab('pickedup')}
        >
          Picked up
          {pickedUpCount > 0 && <span className="tab__count">{pickedUpCount}</span>}
        </button>
      </nav>
      <main className="panel__body">
        {tab === 'active' ? (
          <OrderList
            orders={orders}
            statuses={ACTIVE_STATUSES}
            emptyText="Nothing on the way — you're all caught up."
            onAdvance={handleAdvance}
            onEdit={(order) => setView({ mode: 'edit', order })}
            onDelete={handleDelete}
          />
        ) : (
          <>
            <OrderList
              orders={orders}
              statuses={PICKEDUP_STATUSES}
              emptyText="No picked-up orders yet."
              onAdvance={handleAdvance}
              onEdit={(order) => setView({ mode: 'edit', order })}
              onDelete={handleDelete}
            />
            {orders.length > 0 && (
              <ManageData
                pickedUpCount={pickedUpCount}
                onClearPickedUp={handleClearPickedUp}
                onResetAll={handleResetAll}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
