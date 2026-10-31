import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { AgentsFile, FILE_SERVICE } from '../index.js'
import { MAX_BYTES } from '../file.js'

test('read, write, and refuse a stale mtime', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agents-md-'))
  try {
    const file = join(dir, 'AGENTS.md')
    const api = new AgentsFile(file)
    const missing = api.read()
    assert.equal(missing.ok, true)
    assert.equal(missing.exists, false)
    assert.equal(missing.text, '')
    assert.equal(missing.mtime, 0)

    const created = api.write('# rules\n', 0)
    assert.equal(created.ok, true)
    assert.equal(created.bytes > 0, true)

    const loaded = api.read()
    assert.equal(loaded.text, '# rules\n')
    const stale = api.write('# other\n', loaded.mtime - 1)
    assert.equal(stale.ok, false)
    assert.equal(stale.code, 'conflict')
    assert.equal(api.read().text, '# rules\n')

    const saved = api.write('# other\n', loaded.mtime)
    assert.equal(saved.ok, true)
    assert.equal(api.read().text, '# other\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a file over the cap is not returned and cannot be saved from a short body', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'agents-md-'))
  try {
    const file = join(dir, 'AGENTS.md')
    await writeFile(file, 'x'.repeat(MAX_BYTES + 8))
    const api = new AgentsFile(file)
    const loaded = api.read()
    assert.equal(loaded.ok, false)
    assert.equal(loaded.code, 'too-large')
    assert.equal(loaded.text, undefined)
    const refused = api.write('short', loaded.mtime)
    assert.equal(refused.ok, false)
    assert.equal(refused.code, 'too-large')
    assert.equal(api.read().code, 'too-large')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('remote markers name read and write on the file service', () => {
  const marker = Object.getOwnPropertyDescriptor(
    AgentsFile.prototype,
    '@deepseek-ai/dsh-typert-protocol/remote-methods',
  ).value
  assert.equal(FILE_SERVICE, 'systemAgentsMd')
  assert.equal(marker.version, 1)
  assert.deepEqual(marker.methods.map((method) => method.method), ['read', 'write'])
  assert.equal(marker.methods[0].invocation.kind, 'direct')
  const sample = new AgentsFile('C:/unused/AGENTS.md')
  assert.equal(sample.typertRemote.service, sample)
  assert.equal(sample.typertRemote.namespace, FILE_SERVICE)
})
