import type { FC } from 'react'
import { Link } from 'react-router'

import type { BreadcrumbItem } from '~/atoms/dashboard'

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

const breadcrumbStyles = {
  container: 'flex items-center space-x-2 text-sm mb-6',
  item: 'flex items-center',
  link: 'text-placeholder-text hover:text-text transition-colors',
  active: 'text-text font-medium',
  separator: 'mx-2 text-placeholder-text',
}

export const Breadcrumb: FC<BreadcrumbProps> = ({ items }) => {
  if (items.length === 0) return null

  return (
    <nav className={breadcrumbStyles.container}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={breadcrumbStyles.item}>
          {index > 0 && (
            <i
              className={`i-mingcute-arrow-right-line w-4 h-4 ${breadcrumbStyles.separator}`}
            />
          )}

          {item.href && !item.active ? (
            <Link to={item.href} className={breadcrumbStyles.link}>
              {item.label}
            </Link>
          ) : (
            <span
              className={
                item.active ? breadcrumbStyles.active : breadcrumbStyles.link
              }
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}
