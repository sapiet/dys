// Le remplissage de la piste est piloté par une variable CSS : WebKit ne sait
// pas colorer la portion parcourue d'un `input[type=range]`, contrairement à
// Firefox qui expose `::-moz-range-progress`.
export function SeekBar({ value, max, onSeek, className = '' }) {
  const bounded = max > 0 ? Math.min(value, max) : 0
  const progress = max > 0 ? (bounded / max) * 100 : 0

  return (
    <input type="range" min="0" max={max || 0} step="0.1" value={bounded}
      onChange={(event) => onSeek(Number(event.target.value))}
      aria-label="Position de lecture"
      className={`seek ${className}`}
      style={{ '--seek-progress': `${progress}%` }} />
  )
}
