#!/usr/bin/env node
// Claudron's tap into a Claude Code session running in CLI mode.
//
//   claudron-tap statusline <dir> <id>   status line command: saves Claude Code's
//                                      status JSON, then runs the user's own
//                                      status line (if any) so nothing is lost
//   claudron-tap event <dir> <id> <kind> hook command: appends one event line
//
// Runs under Electron with ELECTRON_RUN_AS_NODE=1, so it needs no Node install.
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const [, , mode, dir, id, kind] = process.argv

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8')
  } catch {
    return ''
  }
}

function safeId(s) {
  return String(s || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_')
}

try {
  fs.mkdirSync(dir, { recursive: true })
} catch {}

const input = readStdin()

if (mode === 'statusline') {
  try {
    const file = path.join(dir, `${safeId(id)}.status.json`)
    fs.writeFileSync(file + '.tmp', input)
    fs.renameSync(file + '.tmp', file)
  } catch {}
  const user = process.env.CLAUDRON_USER_STATUSLINE
  if (user) {
    const r = spawnSync(user, { input, shell: true, encoding: 'utf8', timeout: 4000 })
    if (r.stdout) process.stdout.write(r.stdout)
  }
} else if (mode === 'event') {
  try {
    const line = JSON.stringify({ kind, at: Date.now() }) + '\n'
    fs.appendFileSync(path.join(dir, `${safeId(id)}.events.jsonl`), line)
  } catch {}
}
process.exit(0)
