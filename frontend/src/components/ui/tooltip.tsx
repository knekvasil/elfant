import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const handleEnter = () => {
    const el = ref.current
    if (el) {
      const r = el.getBoundingClientRect()
      setPos({ top: r.top - 4, left: r.left + r.width / 2 })
    }
    setShow(true)
  }

  return (
    <div ref={ref} className="inline-flex" onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && createPortal(
        <div
          className={cn(
            'fixed z-[9999] -translate-x-1/2 -translate-y-full',
            'px-3 py-2 rounded-lg shadow-lg border border-border/40 bg-popover text-popover-foreground',
            'text-[10px] leading-relaxed min-w-[220px]',
            'pointer-events-none',
          )}
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 -mt-px rotate-45 bg-popover border-r border-b border-border/40" />
        </div>,
        document.body,
      )}
    </div>
  )
}
