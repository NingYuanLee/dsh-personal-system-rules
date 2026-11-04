import { existsSync, readdirSync, readFileSync, watchFile, unwatchFile } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { MAX_BYTES, readAgentsFile, writeAgentsFile } from './file.js'
import { countRepeatSteps, staleTodoSteps } from './loop-guard.js'

/** Cordis plugin name. */
export const name = 'system-agents-md'

/** The prompt registry this plugin contributes to. */
export const inject = ['systemPrompt']

const SECTION_NAME = 'user:agents-md'
const DEFAULT_ORDER = 10150
const DEFAULT_MAX_SILENT_STEPS = 2
const DEFAULT_MAX_STALE_TODO_STEPS = 6
const DEFAULT_RULES_FILE = 'PERSONAL-SYSTEM-RULES.md'
const DEFAULT_HEADER = [
  '# 用户全局系统层规则',
  '',
  '以下内容来自用户全局 PERSONAL-SYSTEM-RULES.md，是系统层指令，必须遵守；与项目内软性说明冲突时以本节为准。',
].join('\n')

/** Default reminder used when consecutive steps carry no visible text. */
const DEFAULT_SILENT_REMINDER = '你已经连续 {count} 步没有向用户说明进展。请在本步开头用一句话说明正在做什么、为什么，再继续调用工具。'

/** Default reminder used when the same tool call repeats beyond the limit. */
const DEFAULT_REPEAT_REMINDER = '你已经连续 {count} 步执行完全相同的操作。请停止重复：先说明当前阻塞和已完成的部分，再换一种做法；如果确实需要继续同一操作，请先向用户说明原因。'

/** Default reminder used when the task list stops moving while items stay in progress. */
const DEFAULT_STALE_TODO_REMINDER = '任务列表里有 {inProgress} 项仍标着进行中，但已连续 {count} 步没有更新。请重写 todo 列表：把已完成的项标成 completed，只留下真正在做的一项，再继续。'

/** Wire namespace for the detail-page editor and the settings dialog. */
export const FILE_SERVICE = 'systemAgentsMd'

/** Marker the Typert gateway's source-mode discovery reads. */
const REMOTE_METHODS = '@deepseek-ai/dsh-typert-protocol/remote-methods'

/**
 * Config schema projected into the DSH settings dialog.
 *
 * `file`, `maxSilentSteps` and `silentReminder` are `.volatile()`: that is what
 * makes them editable from the GUI settings form (see volatileForm() in
 * @deepseek-ai/dsh-settings) and what lets a save apply without reloading the
 * plugin. The remaining fields stay ordinary config for cordis.patch.yml.
 *
 * schemastery is loaded from the running DSH install at module scope, so this
 * package keeps no node_modules of its own. If it cannot be found the plugin
 * still injects rules; only the settings form's config cards degrade.
 */
export const Config = await loadConfigSchema()

/**
 * Build the optional config schema.
 * @returns {Promise<object | undefined>} schemastery schema, or undefined when schemastery is unavailable.
 */
async function loadConfigSchema() {
  const z = await loadSchemastery()
  if (z === undefined) {
    console.log('[system-agents-md] schemastery unavailable; settings fields stay read-only')
    return undefined
  }
  return z.object({
    // The rules file path is deliberately ordinary config, not volatile: the
    // settings page edits the rules body and the guard only, and the path
    // defaults to $DSH_HOME/PERSONAL-SYSTEM-RULES.md. Advanced installs can still
    // override it in the profile cordis.patch.yml.
    file: z.string().default(''),
    order: z.number().default(DEFAULT_ORDER),
    header: z.string().default(DEFAULT_HEADER),
    maxSilentSteps: z.number().min(0).default(DEFAULT_MAX_SILENT_STEPS).volatile(),
    silentReminder: z.string().default('').volatile(),
    repeatLimit: z.number().min(0).default(0).volatile(),
    repeatAction: z.union([z.const('remind'), z.const('stop')]).default('remind').volatile(),
    repeatReminder: z.string().default('').volatile(),
    maxStaleTodoSteps: z.number().min(0).default(DEFAULT_MAX_STALE_TODO_STEPS).volatile(),
    staleTodoReminder: z.string().default('').volatile(),
  })
}

/**
 * Resolve schemastery: the normal package import first, then the copy shipped
 * with the running DSH install (profile-local or harness-local).
 * @returns {Promise<any | undefined>}
 */
async function loadSchemastery() {
  try {
    const mod = await import('@deepseek-ai/schemastery')
    return mod.default
  } catch { /* not installed next to this package; fall through to the DSH install */ }
  const candidates = []
  const home = dshHome()
  try {
    for (const profile of readdirSync(join(home, 'profiles'))) {
      candidates.push(join(home, 'profiles', profile, 'node_modules', '@deepseek-ai', 'schemastery', 'lib', 'index.mjs'))
    }
  } catch { /* no profiles directory */ }
  candidates.push(join(home, 'node_modules', '@deepseek-ai', 'schemastery', 'lib', 'index.mjs'))
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue
      const mod = await import(pathToFileURL(candidate).href)
      return mod.default
    } catch { /* try the next candidate */ }
  }
  return undefined
}

function dshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return join(homedir(), '.dsh')
}

/** A `.volatile()` config field resolves to a ref object, not to its value. */
function unwrapVolatile(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get()
    } catch {
      return undefined
    }
  }
  return value
}

/**
 * Effective values for one config snapshot. Volatile fields are read through
 * their refs, so calling this again picks up settings saved from the GUI.
 * @param {object} config raw plugin config
 */
function resolveSettings(config = {}) {
  const fileValue = unwrapVolatile(config.file)
  const file = typeof fileValue === 'string' && fileValue.trim() ? fileValue.trim() : join(dshHome(), DEFAULT_RULES_FILE)
  const order = Number.isFinite(Number(config.order)) ? Number(config.order) : DEFAULT_ORDER
  const header = typeof config.header === 'string' ? config.header : DEFAULT_HEADER
  const stepsValue = Number(unwrapVolatile(config.maxSilentSteps))
  const maxSilentSteps = Number.isFinite(stepsValue) ? Math.max(0, Math.floor(stepsValue)) : DEFAULT_MAX_SILENT_STEPS
  const reminderValue = unwrapVolatile(config.silentReminder)
  const silentTemplate = typeof reminderValue === 'string' && reminderValue.trim() ? reminderValue : DEFAULT_SILENT_REMINDER
  const repeatLimitValue = Number(unwrapVolatile(config.repeatLimit))
  const repeatLimit = Number.isFinite(repeatLimitValue) ? Math.max(0, Math.floor(repeatLimitValue)) : 0
  const repeatAction = unwrapVolatile(config.repeatAction) === 'stop' ? 'stop' : 'remind'
  const repeatReminderValue = unwrapVolatile(config.repeatReminder)
  const repeatTemplate = typeof repeatReminderValue === 'string' && repeatReminderValue.trim() ? repeatReminderValue : DEFAULT_REPEAT_REMINDER
  const staleStepsValue = Number(unwrapVolatile(config.maxStaleTodoSteps))
  const maxStaleTodoSteps = Number.isFinite(staleStepsValue) ? Math.max(0, Math.floor(staleStepsValue)) : DEFAULT_MAX_STALE_TODO_STEPS
  const staleReminderValue = unwrapVolatile(config.staleTodoReminder)
  const staleTemplate = typeof staleReminderValue === 'string' && staleReminderValue.trim() ? staleReminderValue : DEFAULT_STALE_TODO_REMINDER
  return {
    file,
    order,
    header,
    maxSilentSteps,
    silentTemplate,
    repeatLimit,
    repeatAction,
    repeatTemplate,
    maxStaleTodoSteps,
    staleTemplate,
  }
}

/**
 * Host service the plugin detail page and the settings page call through
 * /api/systemAgentsMd/*. Markers are attached without decorator syntax so the
 * plugin stays plain ESM.
 */
export class AgentsFile {
  /**
   * @param {string} file absolute path of the rules file.
   */
  constructor(file) {
    this.file = file
    this.typertRemote = Object.freeze({
      service: this,
      serviceKey: FILE_SERVICE,
      namespace: FILE_SERVICE,
    })
  }

  /** Current file body, or a too-large / io failure that does not include the body. */
  read() {
    try {
      const state = readAgentsFile(this.file, MAX_BYTES)
      if (state.tooLarge) {
        return { ok: false, code: 'too-large', path: this.file, bytes: state.bytes, mtime: state.mtime }
      }
      return {
        ok: true,
        path: this.file,
        exists: state.exists,
        text: state.text,
        bytes: state.bytes,
        mtime: state.mtime,
      }
    } catch (error) {
      return { ok: false, code: 'io', path: this.file, message: error?.message ?? String(error) }
    }
  }

  /**
   * Replace the file. expectedMtime is the mtime from the last read; a mismatch
   * refuses the write so an outside edit is not overwritten.
   * @param {string} text
   * @param {number} expectedMtime
   */
  write(text, expectedMtime) {
    if (typeof text !== 'string') return { ok: false, code: 'invalid', path: this.file, message: 'text must be a string' }
    const bytes = Buffer.byteLength(text)
    if (bytes > MAX_BYTES) return { ok: false, code: 'too-large', path: this.file, bytes }
    let current
    try {
      current = readAgentsFile(this.file, MAX_BYTES)
    } catch (error) {
      return { ok: false, code: 'io', path: this.file, message: error?.message ?? String(error) }
    }
    if (current.tooLarge) return { ok: false, code: 'too-large', path: this.file, bytes: current.bytes, mtime: current.mtime }
    if (typeof expectedMtime === 'number' && expectedMtime !== current.mtime) {
      return {
        ok: false,
        code: 'conflict',
        path: this.file,
        mtime: current.mtime,
        bytes: current.bytes,
        exists: current.exists,
        text: current.tooLarge ? undefined : current.text,
        tooLarge: current.tooLarge === true,
      }
    }
    try {
      const written = writeAgentsFile(this.file, text)
      return { ok: true, path: this.file, bytes: written.bytes, mtime: written.mtime }
    } catch (error) {
      return { ok: false, code: 'io', path: this.file, message: error?.message ?? String(error) }
    }
  }
}

markRemote(AgentsFile.prototype, ['read', 'write'])

/** Attach source-mode Remote markers in declaration order. */
function markRemote(prototype, methods) {
  Object.defineProperty(prototype, REMOTE_METHODS, {
    configurable: true,
    value: Object.freeze({
      version: 1,
      methods: Object.freeze(methods.map((method) => Object.freeze({
        method,
        invocation: Object.freeze({ kind: 'direct' }),
      }))),
    }),
  })
}

/** Recursively freeze a plain JSON value (mirrors the session message factory). */
function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Object.keys(value)) deepFreeze(value[key])
  }
  return value
}

/** Build an identified, frozen user message without importing the harness package. */
function createUserMessage(input) {
  return deepFreeze(structuredClone({ ...input, id: randomUUID(), role: 'user' }))
}

function readRules(file) {
  try {
    const text = readFileSync(file, 'utf8')
    if (!text.trim()) return ''
    return text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text
  } catch {
    return ''
  }
}

/** Whether one assistant message carries visible text the user can read. */
function hasVisibleText(message) {
  const content = message?.content
  if (!Array.isArray(content)) return false
  return content.some((part) => part?.type === 'text' && String(part.text ?? '').trim() !== '')
}

/** Count trailing assistant steps without visible text since the last user turn. */
function countSilentSteps(agent) {
  const nodes = agent?.session?.surface?.nodes
  if (!Array.isArray(nodes)) return 0
  let count = 0
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const event = agent.session.eventAt(nodes[index])
    if (event === undefined) continue
    if (event.type === 'assistant/message') {
      if (hasVisibleText(event.data?.message)) return count
      count += 1
      continue
    }
    if (event.type === 'turn/start') return count
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') return count
  }
  return count
}

/**
 * Register the rules file as a global system-prompt section, keep it in sync
 * when the file or the volatile config changes, expose it to the settings and
 * detail pages, and nudge the model when it runs several steps without visible
 * text.
 * @param {object} ctx - host plugin context.
 * @param {{file?: string, order?: number, header?: string, maxSilentSteps?: number, silentReminder?: string}} [config]
 */
export function apply(ctx, config = {}) {
  let current = resolveSettings(config)
  const fileService = new AgentsFile(current.file)

  try {
    ctx.provide(FILE_SERVICE, fileService)
  } catch (error) {
    console.log('[system-agents-md] file editor unavailable: ' + (error?.message ?? error))
  }

  // The rules file moved by a settings save: switch the watched path, the
  // editor service target and the injected section in one pass.
  ctx.effect(() => {
    let section = null
    let watched = null
    const disposeSection = () => {
      if (section === null) return
      const dispose = section
      section = null
      try { dispose() } catch { /* already gone */ }
    }
    const register = () => {
      const next = resolveSettings(config)
      current = next
      fileService.file = next.file
      if (watched !== next.file) {
        if (watched !== null) unwatchFile(watched, register)
        watchFile(next.file, { interval: 1000 }, register)
        watched = next.file
      }
      disposeSection()
      const body = readRules(next.file)
      if (!body) return
      try {
        section = ctx.systemPrompt.section({
          name: SECTION_NAME,
          order: next.order,
          text: next.header + '\n\n' + body,
          interpolate: false,
        })
      } catch (error) {
        console.log('[system-agents-md] failed to register system prompt section: ' + (error?.message ?? error))
      }
    }
    register()
    const offVolatile = ctx.on('loader/volatile-update', register)
    return () => {
      try { offVolatile() } catch { /* disposed with the fiber */ }
      if (watched !== null) unwatchFile(watched, register)
      disposeSection()
    }
  }, 'system-agents-md.section')

  // One pre-step hook drives three guards:
  // - silent guard: consecutive steps without visible text;
  // - loop guard: consecutive identical tool-call steps (remind, or stop the
  //   turn the way the user's own stop does, keeping queued input);
  // - stale-todo guard: a task list left with `in_progress` items that the
  //   model has not rewritten for several steps.
  // Settings edits are volatile, so `current` is read on every step. A guard
  // disabled with 0 resets its own per-agent state.
  const silentRemindedAt = new WeakMap()
  const repeatState = new WeakMap()
  const staleRemindedAt = new WeakMap()
  ctx.effect(() => ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    if (decision.kind === 'reject') return decision
    const agent = payload.agent
    if (agent === undefined) return decision
    const additions = Array.isArray(decision.messages) ? [...decision.messages] : []

    const silentLimit = current.maxSilentSteps
    if (silentLimit <= 0) {
      silentRemindedAt.delete(agent)
    } else {
      const streak = countSilentSteps(agent)
      if (streak < silentLimit) {
        silentRemindedAt.delete(agent)
      } else if ((silentRemindedAt.get(agent) ?? 0) < streak) {
        silentRemindedAt.set(agent, streak)
        additions.push(createUserMessage({
          content: [{ type: 'text', text: current.silentTemplate.replaceAll('{count}', String(streak)) }],
          source: { kind: 'system-agents-md', form: 'notice', summary: streak + ' steps without visible text' },
        }))
      }
    }

    const repeatLimit = current.repeatLimit
    if (repeatLimit <= 0) {
      repeatState.delete(agent)
    } else {
      const found = countRepeatSteps(agent)
      const previous = repeatState.get(agent)
      if (found.streak < repeatLimit) {
        repeatState.delete(agent)
      } else if (!(previous !== undefined && previous.signature === found.signature && found.streak < previous.streak + repeatLimit)) {
        repeatState.set(agent, { signature: found.signature, streak: found.streak })
        if (current.repeatAction === 'stop') {
          console.log('[system-agents-md] loop guard stopped a repeated action after ' + found.streak + ' steps')
          try {
            agent.cancel({ kind: 'user' }, { keepInbox: true })
          } catch (error) {
            console.log('[system-agents-md] loop guard could not cancel the turn: ' + (error?.message ?? error))
          }
          return decision
        }
        additions.push(createUserMessage({
          content: [{ type: 'text', text: current.repeatTemplate.replaceAll('{count}', String(found.streak)) }],
          source: { kind: 'system-agents-md', form: 'notice', summary: found.streak + ' repeated identical tool calls' },
        }))
      }
    }

    const staleLimit = current.maxStaleTodoSteps
    if (staleLimit <= 0) {
      staleRemindedAt.delete(agent)
    } else {
      const stale = staleTodoSteps(agent)
      if (!stale.hasList || stale.inProgress === 0 || stale.steps < staleLimit) {
        staleRemindedAt.delete(agent)
      } else if (stale.steps >= (staleRemindedAt.get(agent) ?? 0) + staleLimit) {
        // One reminder per staleLimit further steps: the counter cannot drop
        // until the model rewrites the list, so a plain `> last` would nag on
        // every following step.
        staleRemindedAt.set(agent, stale.steps)
        additions.push(createUserMessage({
          content: [{
            type: 'text',
            text: current.staleTemplate
              .replaceAll('{count}', String(stale.steps))
              .replaceAll('{inProgress}', String(stale.inProgress)),
          }],
          source: { kind: 'system-agents-md', form: 'notice', summary: stale.steps + ' steps since the last todo update' },
        }))
      }
    }

    return additions.length === 0 ? decision : { ...decision, messages: additions }
  }), 'system-agents-md.guards')

  // The settings dialog owns this plugin's page now, so the auto-generated form
  // would be a second, conflicting surface. Registered inside an optional
  // `settings` child so a deployment without @deepseek-ai/dsh-settings still
  // loads the prompt section.
  if (typeof ctx.inject === 'function') {
    try {
      ctx.inject(['settings'], (sub) => {
        sub.effect(() => sub.settings.configure({ auto: false }, ctx.fiber), 'system-agents-md.settings-policy')
      })
    } catch (error) {
      console.log('[system-agents-md] settings policy unavailable: ' + (error?.message ?? error))
    }
  }
}
