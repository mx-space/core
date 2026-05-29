import { Navigate, useLocation } from 'react-router'

export function LegacyStaticRedirect(props: { to: string }) {
  const location = useLocation()
  return (
    <Navigate replace to={`${props.to}${location.search}${location.hash}`} />
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
