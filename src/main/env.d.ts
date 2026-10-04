/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** Optional default Spotify client id baked in at build time. Not a secret (PKCE). */
  readonly MAIN_VITE_SPOTIFY_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
