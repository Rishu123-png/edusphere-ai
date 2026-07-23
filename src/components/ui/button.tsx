import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-full text-[15px] font-semibold ring-offset-transparent transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] select-none",
  {
    variants: {
      variant: {
        default: "bg-white/[0.06] text-white border border-white/[0.08] hover:bg-white/[0.10] hover:border-white/[0.12]",
        gradient: "btn-gradient text-white",
        destructive: "text-white shadow hover:opacity-90",
        outline: "border border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white hover:border-brand-primary/30",
        secondary: "bg-white/[0.05] text-white/80 hover:bg-white/[0.08]",
        ghost: "text-white/50 hover:bg-white/[0.05] hover:text-white",
        link: "text-brand-primary underline-offset-4 hover:underline",
        success: "text-white shadow-[0_6px_16px_rgba(34,197,94,0.25)] hover:opacity-90",
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-9 rounded-full px-4 text-[13px]",
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
