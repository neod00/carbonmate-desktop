"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

interface SelectContextType {
    value?: string
    onValueChange?: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined)

export function Select({ value, onValueChange, children }: { value?: string, onValueChange?: (value: string) => void, children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        if (open) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [open])

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
            <div ref={ref} className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

export function SelectTrigger({ className, children, id }: any) {
    const { open, setOpen } = React.useContext(SelectContext)!

    return (
        <button
            id={id}
            type="button"
            onClick={() => setOpen(!open)}
            className={cn(
                "flex h-11 sm:h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2.5 sm:py-2 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] sm:min-h-0",
                className
            )}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
        </button>
    )
}

export function SelectValue({ placeholder }: { placeholder: string }) {
    const { value } = React.useContext(SelectContext)!
    // This is a bit hacky for MVP: we don't have access to the label of the selected item here easily without traversing children.
    // For now, we'll just display the value or placeholder. 
    // In a real app, use Radix UI.
    return <span>{value || placeholder}</span>
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    const { open, setOpen } = React.useContext(SelectContext)!

    if (!open) return null

    return (
        <div className="absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-[#0a0a0a] text-popover-foreground shadow-md animate-in fade-in-80 w-full mt-1">
            <div className="p-1">{children}</div>
        </div>
    )
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    const { value: selectedValue, onValueChange, setOpen } = React.useContext(SelectContext)!

    return (
        <div
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-2.5 sm:py-1.5 pl-8 pr-2 text-base sm:text-sm outline-none hover:bg-accent hover:text-accent-foreground active:bg-accent/80 touch-manipulation min-h-[44px] sm:min-h-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                selectedValue === value && "bg-accent text-accent-foreground"
            )}
            onClick={() => {
                onValueChange?.(value)
                setOpen(false)
            }}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {selectedValue === value && <Check className="h-4 w-4" />}
            </span>
            {children}
        </div>
    )
}
