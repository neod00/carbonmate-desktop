"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const AccordionContext = React.createContext<{
    value?: string
    onValueChange?: (value: string) => void
}>({})

export function Accordion({ type, collapsible, className, children, ...props }: any) {
    const [value, setValue] = React.useState<string>("")

    const onValueChange = (newValue: string) => {
        setValue(newValue === value && collapsible ? "" : newValue)
    }

    return (
        <AccordionContext.Provider value={{ value, onValueChange }}>
            <div className={cn("space-y-1", className)} {...props}>
                {children}
            </div>
        </AccordionContext.Provider>
    )
}

export function AccordionItem({ value, className, children, ...props }: any) {
    const context = React.useContext(AccordionContext)
    const isOpen = context.value === value

    return (
        <div className={cn("border-b", className)} {...props}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child as any, { isOpen, value })
                }
                return child
            })}
        </div>
    )
}

export function AccordionTrigger({ children, className, isOpen, value, ...props }: any) {
    const context = React.useContext(AccordionContext)

    return (
        <button
            onClick={() => context.onValueChange?.(value)}
            className={cn(
                "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown
                className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180"
                )}
            />
        </button>
    )
}

export function AccordionContent({ children, className, isOpen, ...props }: any) {
    if (!isOpen) return null

    return (
        <div
            className={cn(
                "overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down",
                className
            )}
            {...props}
        >
            <div className="pb-4 pt-0">{children}</div>
        </div>
    )
}
