import { useEffect, useState } from 'react'
import type { OscConfig } from '../../../shared/osc'

function OscControl(): React.JSX.Element {
  const [running, setRunning] = useState(false)
  const [config, setConfig] = useState<OscConfig | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    window.api.osc.isRunning().then(setRunning)
    return window.api.osc.onStatusChanged(setRunning)
  }, [])

  useEffect(() => {
    window.api.osc.getConfig().then(setConfig)
  }, [])

  const toggle = (): void => {
    if (running) window.api.osc.stop()
    else window.api.osc.start()
  }

  const updateConfig = (next: Partial<OscConfig>): void => {
    setConfig((current) => (current ? { ...current, ...next } : current))
    window.api.osc.setConfig(next)
  }

  return (
    <div className="osc-control">
      <button className={`transport-btn${running ? ' active' : ''}`} onClick={toggle}>
        {running ? 'Stop OSC' : 'Start OSC'}
      </button>
      <button
        className="icon-btn"
        title="OSC settings"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        ⚙
      </button>
      {expanded && config && (
        <div className="osc-settings">
          <label>
            Listen port
            <input
              type="number"
              value={config.localPort}
              onChange={(e) => updateConfig({ localPort: Number(e.target.value) })}
            />
          </label>
          <label>
            Feedback host
            <input
              type="text"
              value={config.remoteHost}
              onChange={(e) => updateConfig({ remoteHost: e.target.value })}
            />
          </label>
          <label>
            Feedback port
            <input
              type="number"
              value={config.remotePort}
              onChange={(e) => updateConfig({ remotePort: Number(e.target.value) })}
            />
          </label>
          <p className="osc-settings-hint">
            Matches OSCPoint&rsquo;s own defaults (35551 in / 35550 out) — an existing Companion
            &ldquo;Zinc: OSCPoint&rdquo; connection works against this app with no changes.
          </p>
        </div>
      )}
    </div>
  )
}

export default OscControl
