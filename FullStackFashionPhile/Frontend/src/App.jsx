import { useState, useRef, useEffect } from 'react'
import './index.css'

/* ---- Progress bar helper ---- */
function ProgressBar({ done, total }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

/* ---- Data Table ---- */
function ImageCell({ urls }) {
  // urls can be a comma-separated string or an array
  const list = Array.isArray(urls)
    ? urls
    : String(urls || '').split(',').map(s => s.trim()).filter(Boolean)

  if (list.length === 0) return null

  return (
    <div className="img-cell">
      {list.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noreferrer" className="img-thumb-link">
          <img src={src} alt={`img-${i + 1}`} className="img-thumb" loading="lazy"
            onError={e => { e.currentTarget.style.display = 'none' }} />
        </a>
      ))}
    </div>
  )
}

function DataTable({ data, search }) {
  if (!data || data.length === 0) return null

  const columns = Object.keys(data[0])

  const formatHeader = (str) => {
    return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  const formatValue = (raw) => {
    if (raw == null) return '';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'object') return JSON.stringify(raw);
    return String(raw);
  }

  const isImageCol = col =>
    col.toLowerCase().includes('image') ||
    col.toLowerCase() === 'main_image_url'

  const isUrlCol = col =>
    !isImageCol(col) && (
      col.toLowerCase().includes('url') ||
      col.toLowerCase().includes('link')
    )

  const filtered = search.trim()
    ? data.filter(row =>
        columns.some(col =>
          formatValue(row[col]).toLowerCase().includes(search.toLowerCase())
        )
      )
    : data

  return (
    <div className="table-body-wrap">
      <table className="results-table">
        <thead>
          <tr>
            <th className="col-num">#</th>
            {columns.map(col => (
              <th key={col}>{formatHeader(col)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="empty-row">
                No results match your filter.
              </td>
            </tr>
          ) : (
            filtered.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="col-num">{i + 1}</td>
                {columns.map(col => {
                  const rawVal = row[col]
                  const val = formatValue(rawVal)

                  if (isImageCol(col)) {
                    return (
                      <td key={col}>
                        <ImageCell urls={rawVal} />
                      </td>
                    )
                  }

                  return (
                    <td key={col} title={val}>
                      {isUrlCol(col) ? (
                        <a href={val} target="_blank" rel="noreferrer" className="table-link">
                          {val}
                        </a>
                      ) : (
                        val
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function App() {
  const [url, setUrl]             = useState('')
  const [maxPages, setMaxPages]   = useState(1)
  const [status, setStatus]       = useState('idle')
  const [progress, setProgress]   = useState({ done: 0, total: 0, title: '', brand: '', stage: '' })
  const [results, setResults]     = useState(null)
  const [tableData, setTableData] = useState(null)
  const [search, setSearch]       = useState('')
  const [error, setError]         = useState(null)
  const esRef = useRef(null)

  useEffect(() => {
    if (!results?.json_path) return
    fetch(`http://localhost:8080/api/data/${results.json_path}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => json && setTableData(Array.isArray(json) ? json : [json]))
      .catch(() => {})
  }, [results])

  const handleScrape = async (e) => {
    e.preventDefault()
    if (!url) return

    if (esRef.current) esRef.current.abort()

    setStatus('loading')
    setError(null)
    setResults(null)
    setTableData(null)
    setSearch('')
    setProgress({ done: 0, total: 0, title: '', brand: '', stage: 'starting' })

    try {
      const controller = new AbortController()
      esRef.current = controller

      const resp = await fetch('http://localhost:8080/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, max_pages: Number(maxPages) }),
        signal: controller.signal,
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.detail || 'Request failed')
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const line = part.replace(/^data:\s*/, '').trim()
          if (!line) continue
          try {
            const event = JSON.parse(line)
            if (event.stage === 'heartbeat') continue

            if (event.stage === 'fetched') {
              setProgress(p => ({ ...p, total: event.total, done: 0, stage: 'fetched' }))
            } else if (event.stage === 'scraping') {
              setProgress({ done: event.done, total: event.total, title: event.title, brand: event.brand, stage: 'scraping' })
            } else if (event.stage === 'done') {
              setResults({ csv_path: event.csv_path, json_path: event.json_path })
              setStatus('done')
            } else if (event.stage === 'error') {
              throw new Error(event.message)
            }
          } catch (parseErr) {
            if (parseErr.message !== 'Unexpected end of JSON input') throw parseErr
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message)
        setStatus('error')
      }
    }
  }

  const downloadFile = (filename) => {
    window.location.href = `http://localhost:8080/api/download/${filename}`
  }

  const loading = status === 'loading'
  const isDone  = status === 'done' && results

  const progressText = (() => {
    if (progress.stage === 'starting') return 'Connecting…'
    if (progress.stage === 'fetched')  return `Found ${progress.total} products — starting detail scrape…`
    if (progress.stage === 'scraping') {
      const item = [progress.brand, progress.title].filter(Boolean).join(' · ')
      return `Scraped ${progress.done} / ${progress.total}${item ? ` — ${item}` : ''}`
    }
    return 'Working…'
  })()

  const filteredCount = tableData
    ? (search.trim()
        ? tableData.filter(row =>
            Object.values(row).some(v => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
          ).length
        : tableData.length)
    : 0

  return (
    <div className="app-shell">
      <div className="blob blob-tl" />
      <div className="blob blob-br" />

      {/* ── TOP NAVBAR CARD ── */}
      <header className="top-bar animate-slide-up">
        <div className="top-bar-brand">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          <span>FashionPhile <strong>Scraper</strong></span>
        </div>

        <form className="top-bar-form" onSubmit={handleScrape}>
          <div className="top-field">
            <label htmlFor="url">Collection URL</label>
            <input
              id="url" type="url" required
              placeholder="https://www.fashionphile.com/collections/..."
              value={url} onChange={e => setUrl(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="top-field top-field-sm">
            <label htmlFor="pages">Max Pages</label>
            <input
              id="pages" type="number" min="0"
              value={maxPages} onChange={e => setMaxPages(e.target.value)}
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <><div className="spinner animate-spin" /> Scraping…</>
            ) : (
              <>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                Start Scraper
              </>
            )}
          </button>
        </form>
      </header>

      {/* Live progress (full-width strip under top bar) */}
      {loading && (
        <div className="global-progress animate-fade-in">
          <div className="gp-info">
            <span className="progress-badge">LIVE</span>
            <span className="gp-text">{progressText}</span>
            {progress.total > 0 && (
              <span className="gp-pct">{Math.round((progress.done / progress.total) * 100)}%</span>
            )}
          </div>
          {progress.total > 0 && <ProgressBar done={progress.done} total={progress.total} />}
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="error-box animate-fade-in" style={{ margin: '1.25rem auto', maxWidth: 720, width: '90%' }}>
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div><h4>Scraping failed</h4><p>{error}</p></div>
        </div>
      )}

      {/* ── BOTTOM RESULTS PANEL ── */}
      {isDone && (
        <main className="results-panel animate-fade-in">

          {/* Permanent sticky header */}
          <div className="panel-header">
            <div className="panel-header-left">
              <span className="done-check">✅</span>
              <div className="panel-title-group">
                <h3>Extraction Complete!</h3>
                <p>{progress.total} products scraped</p>
              </div>
              {tableData && (
                <div className="panel-search-wrap">
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className="panel-search"
                    type="text"
                    placeholder="Filter table…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  {search && (
                    <span className="panel-count">{filteredCount} / {tableData.length}</span>
                  )}
                </div>
              )}
            </div>
            <div className="panel-header-right">
              <button className="btn-dl csv" onClick={() => downloadFile(results.csv_path)} disabled={!results.csv_path}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M12 10v6m0 0l-3-3m3 3l3-3"/>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Download CSV
              </button>
              <button className="btn-dl json" onClick={() => downloadFile(results.json_path)} disabled={!results.json_path}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
                Download JSON
              </button>
            </div>
          </div>

          {/* Scrollable table */}
          {tableData
            ? <DataTable data={tableData} search={search} />
            : <p className="table-loading">Loading preview…</p>
          }
        </main>
      )}
    </div>
  )
}

export default App
