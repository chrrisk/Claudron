# Wraith

Desktop wrapper for Claude Code (Electron + React + TypeScript). Windows and macOS.

- Full spec: `docs/DESIGN_SPEC.md`. Visual source of truth: `docs/mockups/*.dc.html` (read colors, sizes and copy from them; their template syntax is not code to port).
- Never use em dashes in UI copy, docs, comments or commits. Use `-` or `·`.
- Dark mode and UI mode are defaults.
- The usage cauldron never estimates. Only real limit percentages from Claude Code / Anthropic; otherwise show the NO READING state.
- Every animation must respect `prefers-reduced-motion`.
- No secrets in the repo. Spotify uses PKCE; tokens go in Electron `safeStorage`.
- Keep the main process thin; renderer talks to it through a typed preload bridge.
- Work in the build order in the spec. Finish and verify each step (app launches, feature works) before starting the next.
