import { useEffect, useState } from 'react'
import type { GmailStatus } from '../../../shared/types'

interface Props {
  onClose: () => void
}

function Settings({ onClose }: Props): React.JSX.Element {
  const [status, setStatus] = useState<GmailStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.otway.gmail.status().then(setStatus)
  }, [])

  const connect = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    const result = await window.otway.gmail.connect()
    setStatus(result)
    if (result.error) setError(result.error)
    setBusy(false)
  }

  const disconnect = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setStatus(await window.otway.gmail.disconnect())
    setBusy(false)
  }

  const connected = status?.connected ?? false

  return (
    <div className="settings">
      <section className="settings__section">
        <div className="settings__row">
          <div>
            <div className="settings__label">Gmail</div>
            <div className={`settings__status ${connected ? 'is-connected' : ''}`}>
              {status === null ? 'Checking…' : connected ? 'Connected' : 'Not connected'}
            </div>
          </div>
          {connected ? (
            <button className="btn" onClick={disconnect} disabled={busy}>
              Disconnect
            </button>
          ) : (
            <button className="btn btn--primary" onClick={connect} disabled={busy}>
              {busy ? 'Waiting for browser…' : 'Connect Gmail'}
            </button>
          )}
        </div>
        {busy && !connected && (
          <p className="settings__hint">
            A browser window opened — approve access, then return here. On the &ldquo;unverified
            app&rdquo; screen, choose Advanced → Go to Otway.
          </p>
        )}
        {error && <p className="settings__error">{error}</p>}
      </section>
      <div className="settings__actions">
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}

export default Settings
