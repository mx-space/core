import { Navigate, useLocation, useParams } from 'react-router'

export function LegacyStaticRedirect(props: { to: string }) {
  const location = useLocation()
  const [toPath, toQuery] = props.to.split('?')
  const merged = new URLSearchParams(location.search)
  for (const [key, value] of new URLSearchParams(toQuery)) {
    merged.set(key, value)
  }
  const search = merged.toString()
  return (
    <Navigate
      replace
      to={`${toPath}${search ? `?${search}` : ''}${location.hash}`}
    />
  )
}

export function LegacyTaskDetailRedirect() {
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  return (
    <Navigate replace to={`/tasks/${id}${location.search}${location.hash}`} />
  )
}

export function LegacyPageRedirect() {
  const location = useLocation()
  const nextPath = location.pathname.replace(/^\/page(?=\/|$)/, '/pages')
  return (
    <Navigate replace to={`${nextPath}${location.search}${location.hash}`} />
  )
}

export function LegacyExtraRedirect() {
  const location = useLocation()
  const nextPath = location.pathname.replace(/^\/extra(?=\/|$)/, '')
  return (
    <Navigate
      replace
      to={`${nextPath || '/'}${location.search}${location.hash}`}
    />
  )
}
