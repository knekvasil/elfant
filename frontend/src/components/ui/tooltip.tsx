import { useState } from 'react'
import { cn } from '../../lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
      <div
        className="relative"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
      {children}
      {show && (
        <div className={cn(
          'absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2',
          'px-3 py-2 rounded-lg shadow-lg border border-border/40 bg-popover text-popover-foreground',
          'text-[10px] leading-relaxed min-w-[220px]',
          'pointer-events-none',
        )}>
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -mt-0.5 rotate-45 bg-popover border-r border-b border-border/40" />
        </div>
      )}
    </div>
  )
}
