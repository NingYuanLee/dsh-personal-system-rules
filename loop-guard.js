/**
 * Pure helpers for the repeated-action loop guard.
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

/**
 * Steps taken since the newest `todo/write` in the current turn, plus how many
 * items that list left `in_progress`.
 *
 * The todo projection is reset by `turn/start`, so a list that is still
 * non-empty was necessarily written in this turn. `hasList` is false when the
 * turn wrote no list yet: the model may be skipping todos on purpose (short
 * tasks), so callers must not nag in that case.
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
    if (event.type === 'todo/write') {
      const todos = Array.isArray(event.data?.todos) ? event.data.todos : []
      return {
        steps,
        inProgress: todos.filter((todo) => todo?.status === 'in_progress').length,
        hasList: true,
      }
    }
    if (event.type === 'assistant/message') {
      steps += 1
      continue
    }
    if (event.type === 'turn/start') break
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') break
  }
  return { steps, inProgress: 0, hasList: false }
}
