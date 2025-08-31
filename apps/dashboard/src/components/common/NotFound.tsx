import { useLocation, useNavigate } from 'react-router'

import { Button } from '../ui/button'

export const NotFound = () => {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header spacer */}
      <div className="h-16" />

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-lg w-full">
          {/* 404 icon and status */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-background-secondary mb-4">
              <svg
                className="w-8 h-8 text-blue"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h1 className="text-6xl font-bold text-text mb-2">404</h1>
            <h2 className="text-2xl font-medium text-text mb-2">
              Page not found
            </h2>
            <p className="text-text-secondary text-lg">
              The page you're looking for doesn't exist
            </p>
          </div>

          {/* Current path info */}
          <div className="bg-material-medium rounded-lg border border-fill-tertiary p-4 mb-8">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-text-tertiary mt-0.5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
                />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-secondary mb-1">
                  Requested URL
                </p>
                <code className="text-sm font-mono text-text bg-material-thin px-2 py-1 rounded break-all">
                  {location.pathname}
                </code>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <Button
              onClick={() => navigate('/')}
              className="flex-1 bg-material-opaque text-text-vibrant hover:bg-control-enabled/90 border-0 h-10 font-medium transition-colors"
            >
              Go Home
            </Button>
            <Button
              onClick={() => navigate(-1)}
              className="flex-1 bg-material-thin text-text border border-fill-tertiary hover:bg-fill-tertiary h-10 font-medium transition-colors"
            >
              Go Back
            </Button>
          </div>

          {/* Help text */}
          <div className="text-center">
            <p className="text-sm text-text-secondary">
              If you think this is a mistake, please check the URL or contact
              support.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="h-16 flex items-center justify-center">
        <p className="text-xs text-text-secondary/50">
          Error 404 • Page not found
        </p>
      </div>
    </div>
  )
}
