"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface DialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    children: React.ReactNode
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
    children: React.ReactNode
}

interface DialogDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
    children: React.ReactNode
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    // ESC key to close
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && open) {
                onOpenChange(false)
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [open, onOpenChange])

    // Prevent body scroll when open
    React.useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    if (!open) return null

    return createPortal(
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
                onClick={() => onOpenChange(false)}
            />
            {/* Content container */}
            <div className="fixed inset-0 flex items-center justify-center p-4">
                {children}
            </div>
        </div>,
        document.body
    )
}

export function DialogContent({ className, children, ...props }: DialogContentProps) {
    return (
        <div
            className={cn(
                "relative bg-background rounded-lg shadow-lg border max-h-[85vh] w-full max-w-lg overflow-auto animate-in zoom-in-95 fade-in-0",
                className
            )}
            onClick={(e) => e.stopPropagation()}
            {...props}
        >
            {children}
        </div>
    )
}

export function DialogHeader({ className, children, ...props }: DialogHeaderProps) {
    return (
        <div
            className={cn("flex flex-col space-y-1.5 p-6 pb-4", className)}
            {...props}
        >
            {children}
        </div>
    )
}

export function DialogTitle({ className, children, ...props }: DialogTitleProps) {
    return (
        <h2
            className={cn("text-lg font-semibold leading-none tracking-tight", className)}
            {...props}
        >
            {children}
        </h2>
    )
}

export function DialogDescription({ className, children, ...props }: DialogDescriptionProps) {
    return (
        <p
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        >
            {children}
        </p>
    )
}

interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export function DialogClose({ className, ...props }: DialogCloseProps) {
    return (
        <button
            className={cn(
                "absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                className
            )}
            {...props}
        >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
        </button>
    )
}
