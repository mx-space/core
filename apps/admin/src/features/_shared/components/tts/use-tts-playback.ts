import { useCallback, useEffect, useRef, useState } from 'react'

export interface TtsPlayback {
  isPlaying: boolean
  playAll: () => void
  playingIndex: null | number
  stop: () => void
  toggleSegment: (index: number) => void
}

/**
 * Drives a single `Audio` element through a list of segment urls so only one
 * voice can sound at a time. `ended` auto-advances to the next segment,
 * which makes "play all" a faithful way to audit the seams between segments.
 */
export function useTtsPlayback(urls: string[]): TtsPlayback {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlsRef = useRef(urls)
  const playingIndexRef = useRef<null | number>(null)
  // The `ended` listener is attached once when the Audio element is created,
  // so it reaches the current playFrom through this ref instead of closing
  // over a stale one.
  const playFromRef = useRef<(index: number) => void>(() => undefined)

  const [playingIndex, setPlayingIndex] = useState<null | number>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const setCurrentIndex = useCallback((index: null | number) => {
    playingIndexRef.current = index
    setPlayingIndex(index)
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.currentTime = 0
    }
    setCurrentIndex(null)
  }, [setCurrentIndex])

  const playFrom = useCallback(
    (index: number) => {
      const url = urlsRef.current[index]
      if (!url) return

      let audio = audioRef.current
      if (!audio) {
        audio = new Audio()
        audio.preload = 'auto'
        audio.addEventListener('play', () => setIsPlaying(true))
        audio.addEventListener('pause', () => setIsPlaying(false))
        audio.addEventListener('ended', () => {
          const current = playingIndexRef.current
          if (current !== null && current + 1 < urlsRef.current.length) {
            playFromRef.current(current + 1)
          } else {
            setCurrentIndex(null)
            setIsPlaying(false)
          }
        })
        audio.addEventListener('error', () => {
          setCurrentIndex(null)
          setIsPlaying(false)
        })
        audioRef.current = audio
      }

      setCurrentIndex(index)
      // Always reassign src: replaying the same segment should restart it.
      audio.src = url
      const playPromise = audio.play()
      if (playPromise) {
        playPromise.catch(() => {
          setCurrentIndex(null)
          setIsPlaying(false)
        })
      }
    },
    [setCurrentIndex],
  )

  useEffect(() => {
    playFromRef.current = playFrom
  }, [playFrom])

  // Keep the live url list in sync for the `ended` listener. If the urls
  // change underneath an in-flight playback (language switch, regenerated
  // segments), stop rather than keep playing a segment that no longer
  // matches the list.
  useEffect(() => {
    const previous = urlsRef.current
    urlsRef.current = urls
    const current = playingIndexRef.current
    if (current !== null && previous[current] !== urls[current]) {
      stop()
    }
  }, [urls, stop])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audio.removeAttribute('src')
      if (typeof audio.load === 'function') audio.load()
      audioRef.current = null
    }
  }, [])

  const playAll = useCallback(() => {
    playFrom(0)
  }, [playFrom])

  const toggleSegment = useCallback(
    (index: number) => {
      const audio = audioRef.current
      if (playingIndexRef.current === index && audio) {
        if (audio.paused) {
          const playPromise = audio.play()
          if (playPromise) playPromise.catch(() => undefined)
        } else {
          audio.pause()
        }
        return
      }
      playFrom(index)
    },
    [playFrom],
  )

  return { isPlaying, playAll, playingIndex, stop, toggleSegment }
}
