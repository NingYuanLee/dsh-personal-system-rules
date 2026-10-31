import test from 'node:test'
import assert from 'node:assert/strict'
import { countRepeatSteps, messageSignatures, recentToolSteps, repeatStreak, stableArguments } from '../loop-guard.js'

function fakeAgent(events) {
  return {
    session: {
      surface: { nodes: events.map((_, index) => index) },
      eventAt: (index) => events[index],
    },
  }
}

function assistant(...calls) {
  return {
    type: 'assistant/message',
    data: {
      message: {
        content: calls.map(([name, args]) => ({ type: 'tool-call', id: 'call-' + name, name, arguments: args })),
      },
    },
  }
}

function textAnswer(text) {
  return {
    type: 'assistant/message',
    data: { message: { content: [{ type: 'text', text }] } },
  }
}

const turnStart = { type: 'turn/start', data: {} }

test('argument key order does not change the signature', () => {
  assert.equal(stableArguments('{"a":1,"b":2}'), stableArguments('{"b":2,"a":1}'))
  assert.notEqual(stableArguments('{"a":1}'), stableArguments('{"a":2}'))
  assert.equal(stableArguments('not json'), 'not json')
})

test('messageSignatures lists only tool calls in order', () => {
  const message = {
    content: [
      { type: 'text', text: 'hi' },
      { type: 'tool-call', name: 'read', arguments: '{"file_path":"a.md"}' },
      { type: 'tool-call', name: 'grep', arguments: '{"pattern":"x"}' },
    ],
  }
  assert.equal(messageSignatures(message).length, 2)
  assert.ok(messageSignatures(message)[0].startsWith('read\u0000'))
})

test('repeated identical tool calls build a streak', () => {
  const agent = fakeAgent([
    turnStart,
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"a.md"}']),
  ])
  assert.equal(countRepeatSteps(agent).streak, 3)
})

test('a different call or a text-only answer ends the streak', () => {
  const different = fakeAgent([
    turnStart,
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"b.md"}']),
  ])
  assert.equal(countRepeatSteps(different).streak, 1)

  const answered = fakeAgent([
    turnStart,
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"a.md"}']),
    textAnswer('done'),
  ])
  assert.equal(countRepeatSteps(answered).streak, 0)
})

test('repeatStreak ignores an empty step list', () => {
  assert.deepEqual(repeatStreak([]), { streak: 0, signature: '' })
  assert.equal(recentToolSteps(fakeAgent([])).length, 0)
})
