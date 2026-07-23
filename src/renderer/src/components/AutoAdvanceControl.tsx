interface Props {
  enabled: boolean
  intervalSec: number
  paused: boolean
  onEnabledChange: (enabled: boolean) => void
  onIntervalChange: (seconds: number) => void
  onPausedChange: (paused: boolean) => void
}

/** Timed auto-advance — a genuinely new presenter feature (this app is
 * otherwise always presenter/OSC-driven), built specifically so
 * /pdfpresenter/slideshow/pause|resume have a real, existing timer to
 * suspend/resume rather than nothing to act on. */
function AutoAdvanceControl({
  enabled,
  intervalSec,
  paused,
  onEnabledChange,
  onIntervalChange,
  onPausedChange
}: Props): React.JSX.Element {
  return (
    <div className="auto-advance-control">
      <label className="auto-advance-checkbox">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Auto-advance every
      </label>
      <input
        type="number"
        className="auto-advance-interval"
        min={1}
        value={intervalSec}
        disabled={!enabled}
        onChange={(e) => onIntervalChange(Math.max(1, Number(e.target.value)))}
      />
      <span className="auto-advance-unit">sec</span>
      {enabled && (
        <button
          className={`transport-btn${paused ? '' : ' active'}`}
          onClick={() => onPausedChange(!paused)}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      )}
    </div>
  )
}

export default AutoAdvanceControl
