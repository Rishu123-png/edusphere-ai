import * as React from "react"
import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-[15px] text-white placeholder:text-white/30 transition-all",
          "focus:outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10 focus:bg-white/[0.05]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
