"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

// Simplified Select for MVP without Radix UI dependency for now
// In a real app, use @radix-ui/react-select

interface SelectProps {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
}

const SelectContext = React.createContext<SelectProps>({} as SelectProps)

export function Select({ value, onValueChange, children }: SelectProps) {
    return (
        <SelectContext.Provider value={{ value, onValueChange, children }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

export function SelectTrigger({ className, children, id }: any) {
    return (
        <button
            id={id}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
}

export function SelectValue({ placeholder }: { placeholder: string }) {
    const { value } = React.useContext(SelectContext)
    return <span>{value || placeholder}</span>
}

export function SelectContent({ children }: { children: React.ReactNode }) {
    // Mock content display - in real app this would be a popover
    // For MVP, we might need a native select or a better implementation
    // Let's use a native select wrapper for simplicity if possible, but the UI requested is custom.
    // I'll implement a basic native select wrapper instead for stability in MVP without Radix.
    return null
}

export function SelectItem({ value, children }: { value: string; children: React.ReactNode }) {
    return <option value={value}>{children}</option>
}
