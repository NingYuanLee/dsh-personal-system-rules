import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

/** Prompt and editor share one cap so a save cannot exceed what the section injects. */
export const MAX_BYTES = 512 * 1024

/**
 * Read the rules file without loading a body that is over the cap.
 * @param {string} file
 * @param {number} [maxBytes]
 */
export function readAgentsFile(file, maxBytes = MAX_BYTES) {
  let stat
  try {
    stat = statSync(file)
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, bytes: 0, mtime: 0, text: '' }
    throw error
  }
  const mtime = Math.round(stat.mtimeMs)
  if (stat.size > maxBytes) return { exists: true, tooLarge: true, bytes: stat.size, mtime }
  const text = readFileSync(file, 'utf8')
  return { exists: true, tooLarge: false, text, bytes: Buffer.byteLength(text), mtime }
}

/**
 * Replace the file atomically so the prompt watcher never reads a partial write.
 * @param {string} file
 * @param {string} text
 */
export function writeAgentsFile(file, text) {
  const dir = dirname(file)
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, '.' + basename(file) + '.' + process.pid + '.' + randomBytes(6).toString('hex') + '.tmp')
  try {
    writeFileSync(tmp, text, 'utf8')
    renameSync(tmp, file)
  } catch (error) {
    try { unlinkSync(tmp) } catch { /* the temp file may already be gone */ }
    throw error
  }
  const stat = statSync(file)
  return { bytes: stat.size, mtime: Math.round(stat.mtimeMs) }
}
