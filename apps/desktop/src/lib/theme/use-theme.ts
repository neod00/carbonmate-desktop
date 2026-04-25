import * as React from "react"

export type Theme = "dark" | "light"

const STORAGE_KEY = "carbonmate-theme"

function getInitialTheme(): Theme {
    if (typeof window === "undefined") return "dark"
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "dark" || stored === "light") return stored
    if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light"
    return "dark"
}

function applyTheme(theme: Theme) {
    if (typeof document === "undefined") return
    document.documentElement.setAttribute("data-theme", theme)
    document.documentElement.style.colorScheme = theme
}

export function useTheme() {
    const [theme, setThemeState] = React.useState<Theme>(() => getInitialTheme())

    React.useEffect(() => {
        applyTheme(theme)
        localStorage.setItem(STORAGE_KEY, theme)
    }, [theme])

    const setTheme = React.useCallback((next: Theme) => setThemeState(next), [])
    const toggleTheme = React.useCallback(() => {
        setThemeState(prev => (prev === "dark" ? "light" : "dark"))
    }, [])

    return { theme, setTheme, toggleTheme }
}

export function initThemeOnLoad() {
    applyTheme(getInitialTheme())
}
