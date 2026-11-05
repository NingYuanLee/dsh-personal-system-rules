import test from 'node:test'
import assert from 'node:assert/strict'
import { countRepeatSteps, messageSignatures, recentToolSteps, repeatStreak, silentMs, stableArguments, staleTodoSteps } from '../loop-guard.js'

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

/**
 * One assistant step whose `todo_write` call carries the complete list. The
 * `todo/write` event the tool appends is log-only, so this tool call is the only
 * form the guard can see on the surface.
 */
function todoWrite(todos) {
  return assistant(['todo_write', JSON.stringify({ todos })])
}

test('staleTodoSteps reports the steps since the newest list and its in-progress count', () => {
  const agent = fakeAgent([
    turnStart,
    todoWrite([{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }]),
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"b.md"}']),
    assistant(['read', '{"file_path":"c.md"}']),
  ])
  assert.deepEqual(staleTodoSteps(agent), { steps: 3, inProgress: 1, hasList: true })
})

test('staleTodoSteps reports no list when the turn wrote none', () => {
  const agent = fakeAgent([turnStart, assistant(['read', '{"file_path":"a.md"}']), assistant(['read', '{"file_path":"b.md"}'])])
  const found = staleTodoSteps(agent)
  assert.equal(found.hasList, false)
  assert.equal(found.inProgress, 0)
  assert.equal(found.steps, 2)
})

test('staleTodoSteps counts nothing in progress once every item is completed', () => {
  const agent = fakeAgent([turnStart, todoWrite([{ content: 'a', status: 'completed' }]), assistant(['read', '{"file_path":"a.md"}'])])
  assert.deepEqual(staleTodoSteps(agent), { steps: 1, inProgress: 0, hasList: true })
})

test('staleTodoSteps stops at the turn boundary and ignores an older turn list', () => {
  const agent = fakeAgent([
    turnStart,
    todoWrite([{ content: 'old', status: 'in_progress' }]),
    assistant(['read', '{"file_path":"a.md"}']),
    turnStart,
    assistant(['read', '{"file_path":"b.md"}']),
  ])
  assert.deepEqual(staleTodoSteps(agent), { steps: 1, inProgress: 0, hasList: false })
})

test('a log-only todo/write event is not a surface list', () => {
  const agent = fakeAgent([
    turnStart,
    { type: 'todo/write', data: { todos: [{ content: 'a', status: 'in_progress' }] } },
    assistant(['read', '{"file_path":"a.md"}']),
    assistant(['read', '{"file_path":"b.md"}']),
  ])
  assert.deepEqual(staleTodoSteps(agent), { steps: 2, inProgress: 0, hasList: false })
})

test('staleTodoSteps measures from the newest todo_write call', () => {
  const agent = fakeAgent([
    turnStart,
    todoWrite([{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'pending' }]),
    assistant(['read', '{"file_path":"a.md"}']),
    todoWrite([{ content: 'a', status: 'completed' }, { content: 'b', status: 'in_progress' }]),
    assistant(['read', '{"file_path":"b.md"}']),
  ])
  assert.deepEqual(staleTodoSteps(agent), { steps: 1, inProgress: 1, hasList: true })
})

test('staleTodoSteps ignores malformed todo_write arguments', () => {
  const agent = fakeAgent([
    turnStart,
    assistant(['todo_write', '{"todos":[{}']),
    assistant(['read', '{"file_path":"a.md"}']),
  ])
  assert.deepEqual(staleTodoSteps(agent), { steps: 2, inProgress: 0, hasList: false })
})

/** One silent assistant step stamped with an epoch-millisecond time. */
function silentAt(time) {
  return {
    type: 'assistant/message',
    time,
    data: { message: { content: [{ type: 'tool-call', name: 'read', arguments: '{"file_path":"a.md"}' }] } },
  }
}

test('silentMs measures from the newest visible text', () => {
  const now = 1_000_000
  const agent = fakeAgent([
    { type: 'turn/start', time: now - 300_000, data: {} },
    { type: 'assistant/message', time: now - 200_000, data: { message: { content: [{ type: 'text', text: '先说明一句' }] } } },
    silentAt(now - 100_000),
  ])
  assert.equal(silentMs(agent, now), 200_000, 'the silent step alone does not reset the clock')
})

test('silentMs falls back to the turn boundary before any visible text', () => {
  const now = 1_000_000
  const agent = fakeAgent([
    { type: 'user/message', time: now - 400_000, data: { source: { kind: 'user' } } },
    { type: 'turn/start', time: now - 390_000, data: {} },
    silentAt(now - 350_000),
  ])
  assert.equal(silentMs(agent, now), 390_000)
})

test('silentMs is zero without a datable surface', () => {
  assert.equal(silentMs(fakeAgent([]), 1_000), 0)
  assert.equal(silentMs(fakeAgent([turnStart]), 1_000), 0, 'events without a time are not guessed')
})
