import { useState } from 'react'
import type { Order } from '../../../shared/types'

export interface OrderFormValues {
  title: string
  source: string
  expectedDate?: string // ISO 8601
  notes?: string
}

interface Props {
  initial?: Order
  onSave: (values: OrderFormValues) => void
  onCancel: () => void
}

// <input type="date"> works in YYYY-MM-DD; convert to/from the stored ISO.
function toDateInput(iso?: string): string {
  return iso ? iso.slice(0, 10) : ''
}

function fromDateInput(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined
}

function OrderForm({ initial, onSave, onCancel }: Props): React.JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [source, setSource] = useState(initial?.source ?? '')
  const [expected, setExpected] = useState(toDateInput(initial?.expectedDate))
  const [notes, setNotes] = useState(initial?.notes ?? '')

  const canSave = title.trim() !== '' && source.trim() !== ''

  const submit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!canSave) return
    onSave({
      title: title.trim(),
      source: source.trim(),
      expectedDate: fromDateInput(expected),
      notes: notes.trim() || undefined
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="form__label">
        Title
        <input
          className="form__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Wireless keyboard"
          autoFocus
        />
      </label>
      <label className="form__label">
        Source
        <input
          className="form__input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Amazon"
        />
      </label>
      <label className="form__label">
        Expected <span className="form__optional">optional</span>
        <input
          className="form__input"
          type="date"
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
        />
      </label>
      <label className="form__label">
        Notes <span className="form__optional">optional</span>
        <textarea
          className="form__input form__textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </label>
      <div className="form__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!canSave}>
          {initial ? 'Save' : 'Add order'}
        </button>
      </div>
    </form>
  )
}

export default OrderForm
