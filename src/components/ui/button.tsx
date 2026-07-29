import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 min-h-[44px] md:min-h-[36px]",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-hover",
        destructive: "bg-danger text-white hover:bg-red-700",
        outline: "border border-border bg-transparent hover:bg-page hover:text-text-primary",
        secondary: "bg-page text-text-secondary hover:bg-border",
        ghost: "hover:bg-page hover:text-text-primary",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-auto py-2 px-4",
        sm: "rounded-md px-3 text-xs min-h-[44px] md:min-h-[32px] md:py-1",
        lg: "rounded-md px-8 min-h-[44px] md:min-h-[40px]",
        icon: "min-h-[44px] min-w-[44px] md:min-h-[36px] md:min-w-[36px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
