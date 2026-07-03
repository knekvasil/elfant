import { useRender } from "@base-ui/react/use-render"
import { cn } from "../../lib/utils"
import { ChevronRight } from "lucide-react"

function BreadcrumbRoot({
  className,
  ...props
}: useRender.ComponentProps<"nav">) {
  return (
    <nav
      aria-label="breadcrumb"
      className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function BreadcrumbList({ className, ...props }: useRender.ComponentProps<"ol">) {
  return (
    <ol
      className={cn("flex items-center gap-1.5 flex-wrap", className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: useRender.ComponentProps<"li">) {
  return <li className={cn("flex items-center gap-1.5", className)} {...props} />
}

function BreadcrumbLink({
  className,
  ...props
}: useRender.ComponentProps<"a"> & { href?: string }) {
  return (
    <a
      className={cn(
        "text-muted-foreground/60 hover:text-foreground transition-colors",
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ className, ...props }: useRender.ComponentProps<"li">) {
  return (
    <li
      role="presentation"
      aria-hidden="true"
      className={cn("text-muted-foreground/30", className)}
      {...props}
    >
      <ChevronRight className="size-3" />
    </li>
  )
}

function BreadcrumbPage({ className, ...props }: useRender.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-medium text-foreground", className)}
      aria-current="page"
      {...props}
    />
  )
}

export {
  BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
}
