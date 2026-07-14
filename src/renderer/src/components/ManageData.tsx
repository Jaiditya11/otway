import { useState } from 'react'

interface Props {
  pickedUpCount: number
  onClearPickedUp: () => void
  onResetAll: () => void
}

type Pending = 'clear' | 'reset' | null

// Destructive controls use a two-step inline confirm rather than a native
// dialog, since a native dialog would blur (and dismiss) the popover.
function ManageData({ pickedUpCount, onClearPickedUp, onResetAll }: Props): React.JSX.Element {
  const [pending, setPending] = useState<Pending>(null)

  if (pending === 'clear') {
    return (
      <section className="manage">
        <div className="manage__confirm">
          <span className="manage__prompt">Delete all picked-up orders?</span>
          <div className="manage__buttons">
            <button className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                onClearPickedUp()
                setPending(null)
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </section>
    )
  }

  if (pending === 'reset') {
    return (
      <section className="manage">
        <div className="manage__confirm">
          <span className="manage__prompt">Erase all orders? This can&rsquo;t be undone.</span>
          <div className="manage__buttons">
            <button className="btn" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                onResetAll()
                setPending(null)
              }}
            >
              Reset all
            </button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="manage">
      <div className="manage__buttons">
        {pickedUpCount > 0 && (
          <button className="btn manage__btn" onClick={() => setPending('clear')}>
            Clear picked up
          </button>
        )}
        <button className="btn manage__btn manage__btn--reset" onClick={() => setPending('reset')}>
          Reset all data
        </button>
      </div>
    </section>
  )
}

export default ManageData
