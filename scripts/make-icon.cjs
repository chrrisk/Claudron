// Renders build/icon.png (1024x1024) from the logo mark. Run with:
//   npx electron scripts/make-icon.cjs
// electron-builder turns the PNG into .icns and .ico.
const { app, BrowserWindow } = require('electron')
const { writeFileSync, mkdirSync } = require('node:fs')
const { join } = require('node:path')

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="70%">
      <stop offset="0" stop-color="#1d1530"/>
      <stop offset="1" stop-color="#0c0a11"/>
    </radialGradient>
    <clipPath id="tile"><rect x="100" y="100" width="824" height="824" rx="184"/></clipPath>
    <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="22" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="184" fill="url(#bg)"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="184" fill="none" stroke="#3d3350" stroke-width="3"/>
  <g clip-path="url(#tile)"><g transform="translate(212 212) scale(25)" filter="url(#glow)">
    <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" fill="none" stroke="#ff8a3d" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M7.5 10.5l3 1.5-3 1z" fill="#ff8a3d"/>
    <path d="M16.5 10.5l-3 1.5 3 1z" fill="#ff8a3d"/>
    <path d="M8.5 16q3.5 2 7 0" fill="none" stroke="#ff8a3d" stroke-width="1.4" stroke-linecap="round"/>
  </g></g>
</svg>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent">${svg}</body>`))
  await new Promise((r) => setTimeout(r, 300))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  const out = join(__dirname, '..', 'build')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'icon.png'), img.resize({ width: 1024, height: 1024 }).toPNG())
  app.quit()
})
