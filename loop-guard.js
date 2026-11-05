/**
 * Pure helpers for the pre-step guards: the silent reminder, the repeated-action
 * loop guard, and the stale-todo guard.
 *
 * A "repeat step" is one assistant message whose ordered tool calls are
 * identical to the previous assistant message's calls: same tool names and the
 * same arguments (key order normalised). Text-only steps and new user turns end
 * the streak. Keeping this pure makes the detection unit-testable without a
 * live agent session.
 */

/** Stable JSON text for one tool call's raw argument string. */
export function stableArguments(raw) {
  if (typeof raw !== 'string') return ''
  const source = raw.trim()
  if (source === '') return ''
  let parsed
  try {
    parsed = JSON.parse(source)
  } catch {
    return source
  }
  return stableJson(parsed)
}

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + stableJson(value[key])).join(',') + '}'
  }
  return JSON.stringify(value) ?? 'null'
}

/** Signatures of the tool calls carried by one assistant message, in order. */
export function messageSignatures(message) {
  const content = message?.content
  if (!Array.isArray(content)) return []
  return content
    .filter((part) => part?.type === 'tool-call' && typeof part.name === 'string')
    .map((part) => part.name + '\u0000' + stableArguments(part.arguments))
}

/**
 * Assistant messages since the latest user turn, ordered oldest to newest.
 * A text-only assistant message ends the collection: the action streak is over.
 * @param {object} agent live agent (session surface + eventAt)
 */
export function recentToolSteps(agent) {
  const nodes = agent?.session?.surface?.nodes
  if (!Array.isArray(nodes)) return []
  const steps = []
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const event = agent.session.eventAt(nodes[index])
    if (event === undefined) continue
    if (event.type === 'assistant/message') {
      const signatures = messageSignatures(event.data?.message)
      if (signatures.length === 0) break
      steps.push(signatures)
      continue
    }
    if (event.type === 'turn/start') break
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') break
  }
  return steps.reverse()
}

/**
 * Length of the trailing run of identical tool-call steps.
 * @param {string[][]} steps chronological signature lists
 * @returns {{ streak: number, signature: string }}
 */
export function repeatStreak(steps) {
  if (!Array.isArray(steps) || steps.length === 0) return { streak: 0, signature: '' }
  const latest = steps[steps.length - 1]
  if (latest.length === 0) return { streak: 0, signature: '' }
  const key = JSON.stringify(latest)
  let streak = 0
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (JSON.stringify(steps[index]) !== key) break
    streak += 1
  }
  return { streak, signature: key }
}

/**
 * Consecutive identical tool-call steps in the current turn.
 * @param {object} agent live agent
 */
export function countRepeatSteps(agent) {
  return repeatStreak(recentToolSteps(agent))
}

/** Name of the tool whose call carries the complete task list. */
const TODO_TOOL_NAME = 'todo_write'

/** Whether one assistant message carries visible text the user can read. */
export function hasVisibleText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return false
  return content.some((part) => part?.type === 'text' && String(part.text ?? '').trim() !== '')
}

/**
 * Milliseconds since the model last showed the user something readable.
 *
 * Measured from the newest assistant message with visible text; when the turn
 * has shown none yet, from the newest turn boundary. A step-count threshold
 * cannot express this: one long tool step can hold the user in silence for ten
 * minutes while still counting as a single step.
 * @param {object} agent live agent (session surface + eventAt)
 * @param {number} [now] reference clock in epoch milliseconds
 * @returns {number} elapsed milliseconds, 0 when nothing datable is on the surface
 */
export function silentMs(agent, now = Date.now()) {
  const nodes = agent?.session?.surface?.nodes
  if (!Array.isArray(nodes)) return 0
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const event = agent.session.eventAt(nodes[index])
    if (event === undefined) continue
    const time = Number(event.time)
    if (!Number.isFinite(time)) continue
    if (event.type === 'assistant/message') {
      if (hasVisibleText(event.data?.message)) return Math.max(0, now - time)
      continue
    }
    if (event.type === 'turn/start') return Math.max(0, now - time)
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') return Math.max(0, now - time)
  }
  return 0
}

/**
 * The task list a `todo_write` call carries, or null when the message made none.
 *
 * The `todo/write` session event the tool appends is log-only: the surface
 * carries message-producing events only (`system`/`developer`/`user`/
 * `assistant` messages and `tool/result`), so a guard reading
 * `session.surface.nodes` can never see that event. The model's own tool call
 * is the surface-visible record of the same list.
 * @param {object} message one assistant message
 * @returns {object[] | null}
 */
export function todoWriteList(message) {
  const content = message?.content
  if (!Array.isArray(content)) return null
  let todos = null
  for (const part of content) {
    if (part?.type !== 'tool-call' || part.name !== TODO_TOOL_NAME) continue
    todos = parseTodoList(part.arguments) ?? todos
  }
  return todos
}

/** Parse a `todo_write` argument string into its todo array, or null. */
function parseTodoList(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.todos)) return null
  return parsed.todos
}

/**
 * Steps taken since the newest `todo_write` call in the current turn, plus how
 * many items that list left `in_progress`.
 *
 * A list written in an earlier turn is not counted: the scan stops at the turn
 * boundary, and the todos projection is itself reset by `turn/start`.
 * `hasList` is false when the turn wrote no list yet: the model may be skipping
 * todos on purpose (short tasks), so callers must not nag in that case.
 * @param {object} agent live agent (session surface + eventAt)
 * @returns {{ steps: number, inProgress: number, hasList: boolean }}
 */
export function staleTodoSteps(agent) {
  const nodes = agent?.session?.surface?.nodes
  if (!Array.isArray(nodes)) return { steps: 0, inProgress: 0, hasList: false }
  let steps = 0
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const event = agent.session.eventAt(nodes[index])
    if (event === undefined) continue
    if (event.type === 'assistant/message') {
      const todos = todoWriteList(event.data?.message)
      if (todos !== null) {
        return {
          steps,
          inProgress: todos.filter((todo) => todo?.status === 'in_progress').length,
          hasList: true,
        }
      }
      steps += 1
      continue
    }
    if (event.type === 'turn/start') break
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') break
  }
  return { steps, inProgress: 0, hasList: false }
}
