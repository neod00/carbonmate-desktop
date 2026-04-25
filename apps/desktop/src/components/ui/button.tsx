import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "default" | "destructive" | "outline" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "default", size = "default", ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-base sm:text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
                    {
                        "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80": variant === "default",
                        "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80": variant === "destructive",
                        "border border-input bg-background hover:bg-accent hover:text-accent-foreground active:bg-accent/80": variant === "outline",
                        "hover:bg-accent hover:text-accent-foreground active:bg-accent/80": variant === "ghost",
                        "text-primary underline-offset-4 hover:underline": variant === "link",
                        "h-11 sm:h-10 px-4 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0": size === "default",
                        "h-10 sm:h-9 rounded-md px-3 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0": size === "sm",
                        "h-12 sm:h-11 rounded-md px-6 sm:px-8 py-3 sm:py-2.5 min-h-[44px] sm:min-h-0": size === "lg",
                        "h-11 sm:h-10 w-11 sm:w-10 min-h-[44px] sm:min-h-0": size === "icon",
                    },
                    className
                )}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button }
