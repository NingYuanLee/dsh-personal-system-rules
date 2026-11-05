import test from 'node:test'
import assert from 'node:assert/strict'
import { Config } from '../index.js'

// schemastery is borrowed from the running DSH install, so this suite only runs
// where that install is present. The plugin itself degrades gracefully without it.
const skip = Config === undefined ? 'schemastery is unavailable in this environment' : false

test('settings fields resolve to live-editable refs with the documented defaults', { skip }, () => {
  const out = Config['~standard'].validate({})
  assert.equal(out.issues, undefined)
  assert.equal(out.value.file, '')
  assert.equal(out.value.maxSilentSeconds.get(), 60)
  assert.equal(out.value.silentReminder.get(), '')
  assert.equal(out.value.repeatLimit.get(), 0)
  assert.equal(out.value.repeatAction.get(), 'remind')
  assert.equal(out.value.repeatReminder.get(), '')
  assert.match(out.value.header, /^# 用户全局系统层规则/m)
})

test('a config snapshot keeps explicit values and refs for the volatile fields', { skip }, () => {
  const out = Config['~standard'].validate({
    file: 'C:/rules/PERSONAL-SYSTEM-RULES.md',
    maxSilentSeconds: 90,
    silentReminder: '继续说明进展',
    repeatLimit: 4,
    repeatAction: 'stop',
    repeatReminder: '别重复了',
  })
  assert.equal(out.issues, undefined)
  assert.equal(out.value.file, 'C:/rules/PERSONAL-SYSTEM-RULES.md')
  assert.equal(out.value.maxSilentSeconds.get(), 90)
  assert.equal(out.value.silentReminder.get(), '继续说明进展')
  assert.equal(out.value.repeatLimit.get(), 4)
  assert.equal(out.value.repeatAction.get(), 'stop')
  assert.equal(out.value.repeatReminder.get(), '别重复了')
})
