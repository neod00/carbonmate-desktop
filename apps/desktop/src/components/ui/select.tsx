"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

interface SelectContextType {
    value?: string
    onValueChange?: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
    triggerRef: React.RefObject<HTMLButtonElement | null>
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined)

export function Select({ value, onValueChange, children }: { value?: string, onValueChange?: (value: string) => void, children: React.ReactNode }) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node
            // 트리거 또는 portal로 렌더된 SelectContent 외부 클릭만 닫기
            if (ref.current && !ref.current.contains(target)) {
                const portalEl = document.querySelector('[data-select-portal-root]')
                if (!portalEl || !portalEl.contains(target)) {
                    setOpen(false)
                }
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
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen, triggerRef }}>
            <div ref={ref} className="relative">{children}</div>
        </SelectContext.Provider>
    )
}

export function SelectTrigger({ className, children, id }: any) {
    const { open, setOpen, triggerRef } = React.useContext(SelectContext)!

    return (
        <button
            ref={triggerRef}
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
    return <span>{value || placeholder}</span>
}

/**
 * P1-run03-02 회귀 수정: SelectContent를 createPortal로 body에 렌더링하여
 * 부모 컨테이너의 overflow:hidden 클리핑을 회피.
 * 트리거의 getBoundingClientRect로 위치를 계산해 fixed 포지션 적용.
 */
export function SelectContent({ children }: { children: React.ReactNode }) {
    const { open, triggerRef } = React.useContext(SelectContext)!
    const [position, setPosition] = React.useState<{ top: number; left: number; width: number } | null>(null)

    React.useLayoutEffect(() => {
        if (!open || !triggerRef.current) return

        const update = () => {
            const rect = triggerRef.current!.getBoundingClientRect()
            setPosition({
                top: rect.bottom + 4, // trigger 아래 4px 여백
                left: rect.left,
                width: rect.width
            })
        }

        update()
        window.addEventListener('scroll', update, true)
        window.addEventListener('resize', update)
        return () => {
            window.removeEventListener('scroll', update, true)
            window.removeEventListener('resize', update)
        }
    }, [open, triggerRef])

    if (!open || !position) return null
    if (typeof document === 'undefined') return null

    return createPortal(
        <div
            data-select-portal-root
            className="fixed z-[60] min-w-[8rem] max-h-[280px] overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-80"
            style={{
                top: position.top,
                left: position.left,
                width: position.width
            }}
        >
            <div className="p-1">{children}</div>
        </div>,
        document.body
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
