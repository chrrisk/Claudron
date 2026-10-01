import { writeFile } from 'node:fs/promises'
import { app, type BrowserWindow } from 'electron'

/**
 * Dev helper: `WRAITH_SNAPSHOT=out.png npm run dev` captures the window once it
 * settles and quits. Handy for checking layouts against the mockups.
 * WRAITH_SNAPSHOT_EVAL runs a script in the page first (type a prompt, open a popover).
 */
export function maybeSnapshot(win: BrowserWindow): void {
  const target = process.env['WRAITH_SNAPSHOT']
  if (!target) return
  const delay = Number(process.env['WRAITH_SNAPSHOT_DELAY'] ?? 2500)
  const script = process.env['WRAITH_SNAPSHOT_EVAL']
  win.webContents.once('did-finish-load', () => {
    if (script) setTimeout(() => void win.webContents.executeJavaScript(script).catch(console.error), 1500)
    setTimeout(async () => {
      const image = await win.webContents.capturePage()
      await writeFile(target, image.toPNG())
      app.quit()
    }, delay)
  })
}
