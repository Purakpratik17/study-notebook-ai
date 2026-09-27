import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Initialize in a microtask so we don't setState synchronously in the
    // effect body (cascading-render warning); initial paint uses the default.
    const id = window.setTimeout(onChange, 0)
    return () => {
      mql.removeEventListener("change", onChange)
      window.clearTimeout(id)
    }
  }, [])

  return !!isMobile
}
