import { useEffect, useState } from 'react'
import { useHaunt } from '../lib/haunt'

const PUMPKIN = "      ,\n   .-'|'-.\n  / /\\ /\\ \\\n |    /\\   |\n  \\ \\/\\/\\/ /\n   '-.__.-'"

/**
 * Claude Code clears the screen when it starts, so anything written into the
 * terminal first is wiped. The banner lives above the terminal instead and
 * rolls up out of the way on the first keystroke, like output scrolling off.
 */
export function PumpkinBanner({ where, dismissed }: { where: string; dismissed: boolean }): React.JSX.Element {
  const { spooky, full } = useHaunt()
  const [gone, setGone] = useState(dismissed)
  useEffect(() => {
    if (dismissed) setGone(true)
  }, [dismissed])

  return (
    <div className={`cli-banner ${gone ? 'gone' : ''}`} aria-hidden={gone}>
      {spooky ? (
        <div className="banner-row">
          <pre className="pumpkin">{PUMPKIN}</pre>
          <div className="banner-text">
            <span className="banner-title">W R A I T H</span>
            <span className="muted">claude · {where}</span>
            {full && <span className="violet">/\^._.^/\   the bats are out tonight</span>}
          </div>
        </div>
      ) : (
        <div className="muted">
          wraith ▸ claude &nbsp; <span className="fg">{where}</span>
        </div>
      )}
    </div>
  )
}
