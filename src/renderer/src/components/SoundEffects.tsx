import { useEffect, useRef } from 'react'
import { soundDefaults } from '@shared/sounds'
import { useAgent } from '../store/agent'
import { useCli } from '../store/cli'
import { useSettings } from '../store/settings'
import { playBell, playCreak } from '../lib/sounds'

/** Headless: listens for permission prompts and finished tasks and plays the right sound. */
export function SoundEffects(): null {
  const settings = useSettings((s) => s.settings)
  const lastPermissionAt = useAgent((s) => s.lastPermissionAt)
  const lastFinished = useAgent((s) => s.lastFinished)
  const cliPermissionAt = useCli((s) => s.lastPermissionAt)
  const cliStopAt = useCli((s) => s.lastStopAt)
  const sounds = soundDefaults(settings)
  const mounted = useRef(Date.now())

  useEffect(() => {
    if (sounds.door && lastPermissionAt > mounted.current) playCreak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastPermissionAt])

  useEffect(() => {
    if (sounds.bell && lastFinished && lastFinished.at > mounted.current && lastFinished.ok) playBell()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFinished])

  useEffect(() => {
    if (sounds.door && cliPermissionAt > mounted.current) playCreak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliPermissionAt])

  useEffect(() => {
    if (sounds.bell && cliStopAt > mounted.current) playBell()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cliStopAt])

  return null
}
