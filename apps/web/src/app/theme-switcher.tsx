import { useState } from 'react'
import { Moon, Palette, Sun } from 'lucide-react'
import { ACCENTS, ACCENT_SWATCH, useTheme, type Accent } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Light/dark toggle + accent-scheme picker for the nav. Accessible: real
// buttons with aria-labels; the picker is a small popover of color swatches.
export function ThemeSwitcher() {
  const { resolved, accent, toggleMode, setAccent } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label={resolved === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        onClick={toggleMode}
      >
        {resolved === 'dark' ? <Moon /> : <Sun />}
      </Button>

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Choose accent color"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Palette />
        </Button>
        {open && (
          <>
            {/* click-away */}
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
            <div
              role="menu"
              aria-label="Accent color"
              className="absolute right-0 z-20 mt-2 flex gap-2 rounded-lg border border-border bg-popover p-2 shadow-md"
            >
              {ACCENTS.map((a: Accent) => (
                <button
                  key={a}
                  role="menuitemradio"
                  aria-checked={accent === a}
                  aria-label={a}
                  title={a}
                  onClick={() => {
                    setAccent(a)
                    setOpen(false)
                  }}
                  className={cn(
                    'h-6 w-6 rounded-full ring-offset-2 ring-offset-popover transition-transform hover:scale-110',
                    accent === a && 'ring-2 ring-ring',
                  )}
                  style={{ backgroundColor: ACCENT_SWATCH[a] }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
