import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

const PRE_STEP = 'agent/pre-step'

function fakeAgent(events, cancel = () => {}) {
  return {
    cancel,
    session: {
      surface: { nodes: events.map((_, index) => index) },
      eventAt: (index) => events[index],
    },
  }
}

function assistant(calls = [], texts = []) {
  return {
    type: 'assistant/message',
    data: {
      message: {
        content: [
          ...texts.map((text) => ({ type: 'text', text })),
          ...calls.map(([name, args]) => ({ type: 'tool-call', id: 'call-' + name, name, arguments: args })),
        ],
      },
    },
  }
}

const turnStart = { type: 'turn/start', data: {} }
const enter = { kind: 'enter', messages: [] }

function mount(config) {
  const handlers = {}
  const disposers = []
  const ctx = {
    effect(execute) {
      const dispose = execute()
      if (typeof dispose === 'function') disposers.push(dispose)
      return dispose
    },
    on(event, handler) {
      handlers[event] = handler
      return () => { delete handlers[event] }
    },
    systemPrompt: { section: () => () => {} },
    provide() {},
  }
  apply(ctx, config)
  return {
    preStep: (agent) => handlers[PRE_STEP]({ agent, messages: [], turn: 1, step: 1, signal: new AbortController().signal }, async () => enter),
    dispose: () => { for (const dispose of disposers) dispose() },
  }
}

test('the loop guard adds one reminder once the repeat limit is reached', async () => {
  const mounted = mount({ maxSilentSteps: 0, repeatLimit: 2, repeatAction: 'remind', repeatReminder: '重复 {count} 步了，换一种做法。' })
  try {
    const agent = fakeAgent([
      turnStart,
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"a.md"}']]),
    ])
    const decision = await mounted.preStep(agent)
    assert.equal(decision.kind, 'enter')
    assert.equal(decision.messages.length, 1)
    assert.match(decision.messages[0].content[0].text, /重复 2 步/)
    const again = await mounted.preStep(agent)
    assert.equal(again.messages.length, 0, 'one reminder per streak chunk')
  } finally {
    mounted.dispose()
  }
})

test('the loop guard stops the turn through agent.cancel when configured to stop', async () => {
  const calls = []
  const mounted = mount({ maxSilentSteps: 0, repeatLimit: 2, repeatAction: 'stop' })
  try {
    const agent = fakeAgent([
      turnStart,
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"a.md"}']]),
    ], (cause, options) => calls.push({ cause, options }))
    const decision = await mounted.preStep(agent)
    assert.equal(decision.kind, 'enter')
    assert.equal(decision.messages.length, 0)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { cause: { kind: 'user' }, options: { keepInbox: true } })
  } finally {
    mounted.dispose()
  }
})

test('the merged silent guard still reminds steps without visible text', async () => {
  const mounted = mount({ maxSilentSteps: 2, repeatLimit: 0, silentReminder: '说明进展 {count}' })
  try {
    const agent = fakeAgent([
      turnStart,
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"a.md"}']]),
    ])
    const decision = await mounted.preStep(agent)
    assert.equal(decision.messages.length, 1)
    assert.match(decision.messages[0].content[0].text, /说明进展 2/)
  } finally {
    mounted.dispose()
  }
})

function todoWrite(todos) {
  return { type: 'todo/write', data: { todos } }
}

/** Agent whose surface tracks an events array that the test keeps growing. */
function growingAgent(events) {
  return {
    cancel: () => {},
    session: {
      get surface() {
        return { nodes: events.map((_, index) => index) }
      },
      eventAt: (index) => events[index],
    },
  }
}

const staleList = todoWrite([
  { content: 'a', status: 'in_progress' },
  { content: 'b', status: 'pending' },
])

test('the stale-todo guard reminds once the in-progress list has not moved for the limit', async () => {
  const mounted = mount({ maxSilentSteps: 0, repeatLimit: 0, maxStaleTodoSteps: 2, staleTodoReminder: '有 {inProgress} 项进行中，已 {count} 步没更新' })
  try {
    const early = fakeAgent([turnStart, staleList, assistant([['read', '{"file_path":"a.md"}']])])
    assert.equal((await mounted.preStep(early)).messages.length, 0, 'below the limit')

    const agent = fakeAgent([
      turnStart,
      staleList,
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"b.md"}']]),
    ])
    const decision = await mounted.preStep(agent)
    assert.equal(decision.messages.length, 1)
    assert.match(decision.messages[0].content[0].text, /有 1 项进行中，已 2 步没更新/)

    const same = await mounted.preStep(agent)
    assert.equal(same.messages.length, 0, 'no repeat inside the same chunk')
  } finally {
    mounted.dispose()
  }
})

test('the stale-todo guard stays quiet for a finished list or an unwritten one', async () => {
  const mounted = mount({ maxSilentSteps: 0, repeatLimit: 0, maxStaleTodoSteps: 1 })
  try {
    const finished = fakeAgent([
      turnStart,
      todoWrite([{ content: 'a', status: 'completed' }]),
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"b.md"}']]),
    ])
    assert.equal((await mounted.preStep(finished)).messages.length, 0)

    const unwritten = fakeAgent([
      turnStart,
      assistant([['read', '{"file_path":"a.md"}']]),
      assistant([['read', '{"file_path":"b.md"}']]),
    ])
    assert.equal((await mounted.preStep(unwritten)).messages.length, 0, 'short tasks may skip todos')
  } finally {
    mounted.dispose()
  }
})

test('the stale-todo guard reminds again only after another full chunk', async () => {
  const mounted = mount({ maxSilentSteps: 0, repeatLimit: 0, maxStaleTodoSteps: 2 })
  try {
    const events = [turnStart, staleList, assistant([['read', '{"file_path":"a.md"}']]), assistant([['read', '{"file_path":"b.md"}']])]
    const agent = growingAgent(events)
    const first = await mounted.preStep(agent)
    assert.equal(first.messages.length, 1, 'two steps since the last write')

    const next = await mounted.preStep(agent)
    assert.equal(next.messages.length, 0, 'the same chunk is not repeated')

    events.push(assistant([['read', '{"file_path":"c.md"}']]), assistant([['read', '{"file_path":"d.md"}']]))
    const second = await mounted.preStep(agent)
    assert.equal(second.messages.length, 1, 'four steps is a second chunk')
  } finally {
    mounted.dispose()
  }
})
