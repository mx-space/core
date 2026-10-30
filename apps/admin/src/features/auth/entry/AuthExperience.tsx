import './auth-entry.css'

import { ArrowUpRight, Moon, Server, Sun, Waves } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { API_URL, bgUrl } from '~/constants/env'
import { useI18n } from '~/i18n'
import { useThemeMode } from '~/theme'
import { FloatLayerProvider } from '~/ui/overlay/floating-layer'

import faviconUrl from '../../../../favicon.png'
import type { RippleRenderer } from './ripple-renderer'
import type { RippleScene } from './ripple-scenes'

const SceneContext = createContext<((scene: RippleScene) => void) | null>(null)

export function AuthScene({
  scene,
  children,
}: PropsWithChildren<{ scene: RippleScene }>) {
  const setScene = useContext(SceneContext)
  useLayoutEffect(() => {
    setScene?.(scene)
  }, [scene, setScene])
  if (!setScene)
    return <AuthExperience initialScene={scene}>{children}</AuthExperience>
  return <>{children}</>
}

function RippleArtwork({ scene }: { scene: RippleScene }) {
  const { t } = useI18n()
  const canvas = useRef<HTMLCanvasElement>(null)
  const renderer = useRef<RippleRenderer | null>(null)
  const sceneRef = useRef(scene)
  const [state, setState] = useState({ available: false, reducedMotion: false })
  useLayoutEffect(() => {
    sceneRef.current = scene
    renderer.current?.setScene(scene)
  }, [scene])
  useEffect(() => {
    let active = true
    void import('./ripple-renderer')
      .then(({ createRippleRenderer }) => {
        if (!active || !canvas.current) return
        renderer.current = createRippleRenderer(
          canvas.current,
          sceneRef.current,
          setState,
        )
      })
      .catch(() => {
        if (active) setState({ available: false, reducedMotion: false })
      })
    return () => {
      active = false
      renderer.current?.dispose()
      renderer.current = null
    }
  }, [])
  return (
    <div className="auth-entry__artwork">
      <canvas aria-hidden="true" className="auth-entry__canvas" ref={canvas} />
      {!state.available ? (
        <svg
          aria-hidden="true"
          className="auth-entry__fallback"
          viewBox="0 0 440 300"
        >
          <g fill="none" stroke="currentColor" strokeWidth="0.8">
            {Array.from({ length: 22 }, (_, i) => (
              <ellipse
                cx="220"
                cy="145"
                key={i}
                rx={35 + i * 6}
                ry={24 + i * 4.5}
              />
            ))}
          </g>
        </svg>
      ) : null}
      <div className="auth-entry__art-caption text-xs text-fg-subtle">
        <span className="auth-entry__caption-line" />
        <span>{t(`auth.entry.scene.${scene}`)}</span>
        <span className="auth-entry__gesture">{t('auth.entry.interact')}</span>
        <button
          aria-label={t('auth.entry.rippleLabel')}
          className="auth-entry__pulse text-accent"
          disabled={!state.available || state.reducedMotion}
          onClick={() => renderer.current?.pulse()}
          type="button"
        >
          <Waves aria-hidden="true" className="size-3" />
          {state.reducedMotion
            ? t('auth.entry.reducedMotion')
            : t('auth.entry.ripple')}
        </button>
      </div>
    </div>
  )
}

export function AuthExperience({
  initialScene,
  children,
}: PropsWithChildren<{ initialScene: RippleScene }>) {
  const [scene, setScene] = useState(initialScene)
  const { t } = useI18n()
  const { isDark, setThemeMode } = useThemeMode()
  const api =
    API_URL || (typeof location === 'undefined' ? '' : location.origin)
  let service = api
  try {
    service = new URL(api, location.origin).host
  } catch {
    /* A relative override remains readable. */
  }
  const connectionPage = scene === 'connect'
  return (
    <SceneContext.Provider value={setScene}>
      <div
        className="auth-entry bg-surface-page text-fg"
        data-auth-scene={scene}
      >
        <aside className="auth-entry__brand" aria-label="Mix Space">
          {bgUrl ? (
            <div
              aria-hidden="true"
              className="auth-entry__wallpaper"
              style={{ backgroundImage: `url(${bgUrl})` }}
            />
          ) : null}
          <div className="auth-entry__logo text-lg font-semibold">
            <img alt="" src={faviconUrl} />
            <span>Mix Space</span>
            <span className="auth-entry__edition text-xs font-normal text-fg-subtle">
              YOUR DIGITAL GARDEN
            </span>
          </div>
          <div className="auth-entry__intro">
            <p className="auth-entry__eyebrow text-xs text-fg-subtle">
              A SPACE THAT IS YOURS
            </p>
            <h2 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              {t('auth.entry.heroFirst')}
              <br />
              <span className="text-accent">{t('auth.entry.heroSecond')}</span>
            </h2>
            <p className="mt-4 text-sm leading-6 text-fg-muted">
              {t('auth.entry.heroDescriptionFirst')}
              <br />
              {t('auth.entry.heroDescriptionSecond')}
            </p>
          </div>
          <RippleArtwork scene={scene} />
          <div className="auth-entry__brand-footer text-xs text-fg-subtle">
            <span>
              <span className="auth-entry__dot" />
              {t('auth.entry.independent')}
            </span>
            <span>A PLACE OF YOUR OWN.</span>
          </div>
        </aside>
        <div className="auth-entry__workspace bg-surface-card">
          <header className="auth-entry__header">
            <div className="auth-entry__mobile-brand text-lg font-semibold">
              <img alt="" src={faviconUrl} />
              Mix Space
            </div>
            <a
              aria-label={t('auth.entry.currentService')}
              className="auth-entry__service text-xs text-fg-muted"
              href="#/setup-api"
              title={api}
            >
              <span className="auth-entry__dot" />
              {service}
            </a>
            <div className="auth-entry__tools">
              <a
                className="auth-entry__help text-xs text-fg-subtle hover:text-accent"
                href="https://mx-space.js.org"
                rel="noreferrer"
                target="_blank"
              >
                {t('auth.entry.help')}
                <ArrowUpRight aria-hidden="true" className="size-3" />
              </a>
              <button
                aria-label={t(
                  isDark ? 'auth.entry.lightTheme' : 'auth.entry.darkTheme',
                )}
                className="auth-entry__theme text-fg-subtle hover:bg-surface-inset"
                onClick={() => setThemeMode(isDark ? 'light' : 'dark')}
                type="button"
              >
                {isDark ? (
                  <Moon aria-hidden="true" className="size-4" />
                ) : (
                  <Sun aria-hidden="true" className="size-4" />
                )}
              </button>
            </div>
          </header>
          <main className="auth-entry__content">
            <FloatLayerProvider>
              <div className="auth-entry__form">{children}</div>
            </FloatLayerProvider>
          </main>
          <footer className="auth-entry__footer text-xs text-fg-subtle">
            <span>{t('auth.entry.footer')}</span>
            <a
              className="inline-flex items-center gap-1.5 hover:text-accent"
              href={connectionPage ? '#/login' : '#/setup-api'}
            >
              <Server aria-hidden="true" className="size-3" />
              {t(
                connectionPage
                  ? 'auth.entry.backToLogin'
                  : 'auth.entry.switchService',
              )}
            </a>
          </footer>
        </div>
      </div>
    </SceneContext.Provider>
  )
}
