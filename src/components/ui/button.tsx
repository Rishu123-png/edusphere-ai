import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-[15px] font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none",
  {
    variants: {
      variant: {
        default: "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-[0_6px_18px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.16)] hover:scale-[0.98]",
        gradient: "bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 text-white shadow-[0_8px_20px_rgba(79,70,229,0.35)] hover:shadow-[0_12px_28px_rgba(79,70,229,0.45)] hover:scale-[0.98]",
        destructive: "bg-red-500 text-white hover:bg-red-600 shadow",
        outline: "border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800",
        secondary: "bg-slate-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-slate-200 dark:hover:bg-zinc-700",
        ghost: "hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-emerald-500 text-white shadow-[0_6px_16px_rgba(16,185,129,0.3)] hover:bg-emerald-600",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-9 rounded-full px-4 text-sm",
        lg: "h-14 rounded-full px-8 text-base",
        icon: "h-12 w-12",
        pill: "h-10 px-5 rounded-full",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = "Button"

export { Button, buttonVariants }
