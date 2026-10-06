import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import { pickSecret, validateSecretInput, type SecretMeta } from '@shared/ssh'

interface Item extends SecretMeta {
  value: string
}

const file = (): string => join(app.getPath('userData'), 'secrets.bin')
let cache: Item[] | null = null

async function load(): Promise<Item[]> {
  if (cache) return cache
  cache = []
  if (safeStorage.isEncryptionAvailable() && existsSync(file())) {
    try {
      cache = JSON.parse(safeStorage.decryptString(await readFile(file()))) as Item[]
    } catch {
      cache = []
    }
  }
  return cache
}

async function save(items: Item[]): Promise<void> {
  cache = items
  await writeFile(file(), safeStorage.encryptString(JSON.stringify(items)))
}

const strip = ({ id, name, scope }: Item): SecretMeta => ({ id, name, scope })

export async function listSecrets(): Promise<SecretMeta[]> {
  return (await load()).map(strip)
}

export async function addSecret(
  name: string,
  value: string,
  scope: string
): Promise<{ ok: true; secrets: SecretMeta[] } | { ok: false; error: string }> {
  const bad = validateSecretInput(name, value)
  if (bad) return { ok: false, error: bad }
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'This computer has no secure storage available, so Claudron will not save secrets.' }
  }
  const items = (await load()).filter((i) => !(i.name.toLowerCase() === name.toLowerCase() && i.scope === scope))
  items.push({ id: randomUUID(), name, scope, value })
  await save(items)
  return { ok: true, secrets: items.map(strip) }
}

export async function removeSecret(id: string): Promise<SecretMeta[]> {
  const items = (await load()).filter((i) => i.id !== id)
  if (safeStorage.isEncryptionAvailable()) await save(items)
  return items.map(strip)
}

/** For main-process use only. Never exposed over IPC. */
export async function secretValue(name: string, hostId: string): Promise<string | null> {
  const hit = pickSecret(await load(), name, hostId)
  return hit ? hit.value : null
}
