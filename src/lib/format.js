export function duration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Une tablature pèse quelques dizaines de kilo-octets : arrondie en Mo, elle
// s'afficherait « 0 Mo ».
export function fileSize(bytes) {
  if (bytes < 1e6) return `${Math.round(bytes / 1e3)} Ko`
  return `${Math.round(bytes / 1e6)} Mo`
}

// Pour un cumul, la seconde près n'apporte rien et allonge la lecture :
// « 22 min » se saisit mieux que « 22:14 ».
export function totalDuration(seconds) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}
