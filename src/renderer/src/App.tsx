function App(): React.JSX.Element {
  return (
    <div className="panel">
      <header className="panel__header">
        <span className="panel__title">Otway</span>
      </header>
      <main className="panel__body">
        <div className="empty">
          <div className="empty__icon">📦</div>
          <p className="empty__text">Nothing on the way — you&rsquo;re all caught up.</p>
        </div>
      </main>
    </div>
  )
}

export default App
