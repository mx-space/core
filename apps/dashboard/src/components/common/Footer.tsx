import { Button } from '~/components/ui/button'

const REPO_URL = 'https://github.com/mx-space/core'
const PKG_NAME = '@mx-space/dashboard'

export const Footer = () => {
  return (
    <footer className="border-t border-border bg-background-secondary">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col items-center space-y-4">
          {/* 主要内容 */}
          <div className="flex items-center space-x-3 text-sm text-gray-600 dark:text-gray-400">
            <span>Made with ❤️ by</span>
            <a
              href="https://github.com/innei"
              target="_blank"
              rel="noopener noreferrer"
              className="h-auto p-0 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium flex items-center space-x-1"
            >
              <i className="i-mingcute-github-line text-base" />
              <span>@Innei</span>
            </a>
          </div>

          {/* 项目链接 */}
          <div className="flex items-center space-x-4">
            <Button
              asChild
              variant="ghost"
              className="h-auto px-3 py-1.5 text-xs text-text-secondary hover:text-text"
            >
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5"
              >
                <i className="i-mingcute-code-line text-sm" />
                <span>View Source</span>
              </a>
            </Button>

            <div className="w-px h-4 bg-gray-300 dark:bg-gray-700" />

            <span className="text-xs text-text-secondary">{PKG_NAME}</span>
          </div>

          {/* 版权信息 */}
          <div className="text-xs text-text-tertiary text-center">
            © {new Date().getFullYear()} All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
