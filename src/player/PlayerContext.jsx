import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getItem, isVideo, primarySource, resolveUrl } from '../lib/media'

const PlayerContext = createContext(null)

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer doit être utilisé dans un PlayerProvider')
  return value
}

export function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const [videoEl, setVideoEl] = useState(null)
  const [currentId, setCurrentId] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(1)
  // File de lecture : les ids parcourus en boucle quand un média se termine.
  // Vide ou à un seul élément, la lecture s'arrête simplement à la fin.
  const [queue, setQueue] = useState([])

  // Le timecode vit hors du cycle de rendu : c'est lui qu'on transfère d'un
  // élément à l'autre au changement d'angle.
  const timeRef = useRef(0)
  const pendingSeek = useRef(null)

  const current = currentId ? getItem(currentId) : null
  const url = current ? resolveUrl(primarySource(current).path) : null

  // Chaque nature a son élément, et un seul. Faire porter une source vidéo au
  // <audio> de repli lui ferait télécharger le fichier une seconde fois.
  const active = current ? (isVideo(current) ? videoEl : audioRef.current) : null

  useEffect(() => {
    if (!active || !url) return
    const wanted = new URL(url, window.location.href).href
    if (active.src === wanted) return
    pendingSeek.current = timeRef.current
    active.src = url
  }, [active, url])

  // `currentTime` ne tient pas tant que les métadonnées ne sont pas là : on
  // reporte le positionnement plutôt que de l'appliquer dans le vide.
  useEffect(() => {
    if (!active) return

    const apply = () => {
      setDuration(active.duration || 0)
      if (pendingSeek.current === null) return
      active.currentTime = Math.min(pendingSeek.current, active.duration || pendingSeek.current)
      pendingSeek.current = null
    }

    if (active.readyState >= 1) apply()
    active.addEventListener('loadedmetadata', apply)
    return () => active.removeEventListener('loadedmetadata', apply)
  }, [active, url])

  useEffect(() => {
    if (!active) return

    if (!playing) {
      active.pause()
      return
    }

    // Appeler play() pendant le chargement de la source rejette la promesse en
    // AbortError. On attend que l'élément soit prêt plutôt que d'abandonner.
    const start = () => active.play().catch((error) => {
      if (error.name !== 'AbortError') setPlaying(false)
    })

    if (active.readyState >= 2) {
      start()
      return
    }
    active.addEventListener('canplay', start, { once: true })
    return () => active.removeEventListener('canplay', start)
  }, [active, url, playing])

  useEffect(() => {
    if (active) active.volume = volume
  }, [active, volume])

  // L'élément qui vient de perdre la main doit se taire : sans ça, passer du
  // master à un playthrough laisse les deux jouer ensemble.
  useEffect(() => {
    const audio = audioRef.current
    if (audio && active !== audio && !audio.paused) audio.pause()
    if (videoEl && active !== videoEl && !videoEl.paused) videoEl.pause()
  }, [active, videoEl])

  // Quitter la page d'un morceau démonte le <video> : la lecture s'arrête, et
  // l'état doit le refléter plutôt que d'afficher une pause mensongère. On ne
  // réagit qu'au démontage : au montage, l'élément est brièvement absent le
  // temps d'un rendu, et couper la lecture là casserait le changement d'angle.
  const hadVideo = useRef(false)
  useEffect(() => {
    // Uniquement si l'item courant est toujours une vidéo : revenir au master
    // fait aussi disparaître le <video>, mais la lecture doit se poursuivre.
    if (hadVideo.current && !videoEl && current && isVideo(current)) setPlaying(false)
    hadVideo.current = Boolean(videoEl)
  }, [videoEl, current])

  const advance = useCallback((step) => {
    const index = queue.indexOf(currentId)
    if (index === -1 || queue.length < 2) return false
    const next = getItem(queue[(index + step + queue.length) % queue.length])
    if (!next) return false
    timeRef.current = 0
    setTime(0)
    setDuration(next.duration)
    setCurrentId(next.id)
    return true
  }, [queue, currentId])

  useEffect(() => {
    if (!active) return
    const onTime = () => {
      timeRef.current = active.currentTime
      setTime(active.currentTime)
    }
    // Enchaîner sans toucher à `playing` : la lecture se poursuit d'elle-même
    // sur l'élément suivant, et boucle au bout de la file.
    const onEnd = () => {
      if (!advance(1)) setPlaying(false)
    }
    active.addEventListener('timeupdate', onTime)
    active.addEventListener('ended', onEnd)
    return () => {
      active.removeEventListener('timeupdate', onTime)
      active.removeEventListener('ended', onEnd)
    }
  }, [active, advance])

  const play = useCallback((item, { at, queue: nextQueue } = {}) => {
    setQueue(nextQueue ?? [item.id])
    if (item.id !== currentId) {
      timeRef.current = at ?? 0
      setTime(timeRef.current)
      setDuration(item.duration)
      setCurrentId(item.id)
    } else if (at !== undefined) {
      timeRef.current = at
    }
    setPlaying(true)
  }, [currentId])

  // Changer d'angle, c'est la même œuvre vue autrement : la position se
  // conserve et l'état de lecture ne bouge pas.
  const switchTo = useCallback((item) => {
    if (item.id === currentId) return
    setCurrentId(item.id)
    setDuration(item.duration)
  }, [currentId])

  const toggle = useCallback(() => {
    if (currentId) setPlaying((p) => !p)
  }, [currentId])

  const seek = useCallback((seconds) => {
    timeRef.current = seconds
    setTime(seconds)
    if (active) active.currentTime = seconds
  }, [active])

  const setVolume = useCallback((v) => setVolumeState(v), [])

  const value = useMemo(
    () => ({
      current, playing, time, duration, volume, queue,
      videoMounted: Boolean(videoEl),
      play, switchTo, toggle, seek, setVolume, setVideoEl,
      next: () => advance(1),
      previous: () => advance(-1),
    }),
    [current, playing, time, duration, volume, queue, videoEl, play, switchTo, toggle, seek, setVolume, advance],
  )

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" hidden />
    </PlayerContext.Provider>
  )
}
