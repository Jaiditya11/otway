import { useCallback, useEffect, useState } from 'react'
import type { Order } from '../../shared/types'
import OrderForm, { type OrderFormValues } from './components/OrderForm'
import OrderList from './components/OrderList'

type View = { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; order: Order }

function App(): React.JSX.Element {
  const [orders, setOrders] = useState<Order[]>([])
  const [view, setView] = useState<View>({ mode: 'list' })

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

  return (
    <div className="panel">
      <header className="panel__header">
        <span className="panel__title">Otway</span>
        {view.mode === 'list' && (
          <button className="btn btn--add" onClick={() => setView({ mode: 'add' })}>
            + Add
          </button>
        )}
      </header>
      <main className="panel__body">
        {view.mode === 'list' ? (
          <OrderList
            orders={orders}
            onAdvance={handleAdvance}
            onEdit={(order) => setView({ mode: 'edit', order })}
            onDelete={handleDelete}
          />
        ) : (
          <OrderForm
            initial={view.mode === 'edit' ? view.order : undefined}
            onSave={handleSave}
            onCancel={() => setView({ mode: 'list' })}
          />
        )}
      </main>
    </div>
  )
}

export default App
