import type { ReactNode } from 'react'
import { Card, CardContent } from './card'
import { cn } from '../../lib/utils'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  className?: string
}

export default function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <Card className={cn('w-full', className)}>
      <CardContent className="pt-10 pb-10 text-muted-foreground text-sm text-center flex flex-col items-center justify-center gap-3">
        {icon && <div className="flex justify-center">{icon}</div>}
        <div>
          <p className="font-medium">{title}</p>
          {description && <p className="text-xs text-muted-foreground/60 mt-1">{description}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
