import React from 'react'
// Loaded by the web boot graph. The id must match package.json "name".
window.__ModuleLoader__.load({
  id: 'dsh-personal-system-rules',
  factory(require) {
    'use strict'

    const { createElement: h, useEffect, useRef, useState } = React
    const PKG = 'dsh-personal-system-rules'
    /** Settings namespace = this plugin's entry id in the profile cordis.patch.yml. */
    const SETTINGS_NS = 'system-agents-md'
    const READ = 'systemAgentsMd/read'
    const WRITE = 'systemAgentsMd/write'
    /** Mirrors DEFAULT_SILENT_REMINDER on the host side, for the placeholder. */
    const DEFAULT_REMINDER = '你已经连续 {count} 步没有向用户说明进展。请在本步开头用一句话说明正在做什么、为什么，再继续调用工具。'
    /** Mirrors DEFAULT_REPEAT_REMINDER on the host side, for the placeholder. */
    const DEFAULT_REPEAT_REMINDER = '你已经连续 {count} 步执行完全相同的操作。请停止重复：先说明当前阻塞和已完成的部分，再换一种做法；如果确实需要继续同一操作，请先向用户说明原因。'
    /** Mirrors DEFAULT_STALE_TODO_REMINDER on the host side, for the placeholder. */
    const DEFAULT_STALE_TODO_REMINDER = '任务列表里有 {inProgress} 项仍标着进行中，但已连续 {count} 步没有更新。请重写 todo 列表：把已完成的项标成 completed，只留下真正在做的一项，再继续。'

    const zh = {
      nav: '个性化规则',
      title: '个性化规则',
      settingsIntro: '这里配置注入系统提示的规则正文与静默守卫。保存后下一次模型请求生效，不用重启；极简模式下整段不生效。',
      pathHint: '规则文件固定为 `$DSH_HOME/PERSONAL-SYSTEM-RULES.md`（本机为 `~/.dsh/PERSONAL-SYSTEM-RULES.md`）；如确需改路径，请在 profile 的 `cordis.patch.yml` 里配置 `file`。',
      effective: '当前生效文件',
      rulesTitle: '规则正文',
      guardTitle: '守卫',
      silentTitle: '静默提醒',
      guardStepsLabel: '连续无可见文本的步数阈值',
      guardStepsHint: '达到该步数时提醒一次；0 表示关闭。默认 2。',
      guardReminderLabel: '提醒文案',
      guardReminderHint: '可用 {count} 表示当前连续步数；留空使用默认文案。',
      loopTitle: '循环检测',
      loopLimitLabel: '同一操作的最大重复次数',
      loopLimitHint: '连续这么多步执行完全相同的工具调用时触发；0 表示关闭，默认关闭。',
      loopActionLabel: '触发后的动作',
      loopActionRemind: '提醒模型（继续）',
      loopActionStop: '直接叫停本轮',
      loopReminderLabel: '提醒文案',
      loopReminderHint: '可用 {count} 表示已重复的步数；留空使用默认文案。',
      staleTitle: '任务状态',
      staleStepsLabel: '任务列表未更新的步数阈值',
      staleStepsHint: '列表里还有「进行中」的项、且连续这么多步没有重写 todo 时提醒；0 表示关闭。默认 6。',
      staleReminderLabel: '提醒文案',
      staleReminderHint: '可用 {count} 表示未更新的步数、{inProgress} 表示进行中的项数；留空使用默认文案。',
      invalidLimit: '重复次数必须是不小于 0 的整数。',
      saveGuard: '保存守卫',
      savingGuard: '保存中',
      guardSaved: '守卫已保存',
      optionsRejected: '保存被拒绝：配置被更高层覆盖，或另一处刚改过。',
      optionsUnavailable: '当前页面没有配置接口，只能改 cordis.patch.yml。',
      optionsMissing: '没有找到这个插件的设置命名空间，先按默认值显示。',
      optionsLoadFailed: '读取已保存配置失败，先按默认值显示：{message}',
      optionsFailed: '保存失败：{message}',
      invalidSteps: '步数阈值必须是不小于 0 的整数。',
      reload: '重新读取',
      save: '保存',
      saving: '保存中',
      saved: '已写回文件',
      dirty: '有未保存的修改',
      loading: '正在读取…',
      empty: '文件还不存在。保存后会创建它。',
      loadFailed: '读不到这份文件',
      saveFailed: '没能写回文件',
      unavailable: '编辑接口还没挂上。停用再启用本插件，或重启 DSH，然后刷新页面。',
      conflict: '磁盘上的文件在你编辑期间变了，这次没有覆盖。',
      useDisk: '载入磁盘版本',
      tooLarge: '文件超过 512 KiB，页面不打开正文，避免截断后覆盖。请在系统里直接改这个路径。',
      bytes: '{n} 字节',
      editor: '规则正文',
    }

    const en = {
      nav: 'Personalized rules',
      title: 'Personalized rules',
      settingsIntro: 'Configure the rules body injected into the system prompt and the silent-step guard. A save applies on the next model request; no restart. The section is inactive in the minimal preset.',
      pathHint: 'The rules file is fixed at `$DSH_HOME/PERSONAL-SYSTEM-RULES.md` (`~/.dsh/PERSONAL-SYSTEM-RULES.md` here). To change the path, set `file` in the profile `cordis.patch.yml`.',
      effective: 'Effective file',
      rulesTitle: 'Rules body',
      guardTitle: 'Guards',
      silentTitle: 'Silent-step reminder',
      guardStepsLabel: 'Consecutive steps without visible text',
      guardStepsHint: 'Reminds once when reached; 0 disables it. Default 2.',
      guardReminderLabel: 'Reminder text',
      guardReminderHint: 'Use {count} for the current streak; leave blank for the default.',
      loopTitle: 'Loop detection',
      loopLimitLabel: 'Maximum repeats of the same action',
      loopLimitHint: 'Triggers after this many consecutive identical tool-call steps; 0 disables it (default).',
      loopActionLabel: 'Action when triggered',
      loopActionRemind: 'Remind the model (continue)',
      loopActionStop: 'Stop this turn',
      loopReminderLabel: 'Reminder text',
      loopReminderHint: 'Use {count} for the repeated step count; leave blank for the default.',
      staleTitle: 'Task status',
      staleStepsLabel: 'Steps without a todo update',
      staleStepsHint: 'Triggers while the list still has items in progress and it has not been rewritten for this many steps; 0 disables it. Default 6.',
      staleReminderLabel: 'Reminder text',
      staleReminderHint: 'Use {count} for the stale step count and {inProgress} for the in-progress items; leave blank for the default.',
      invalidLimit: 'The repeat limit must be an integer of 0 or more.',
      saveGuard: 'Save guards',
      savingGuard: 'Saving',
      guardSaved: 'Guards saved',
      optionsRejected: 'Not saved: the config is overridden by a higher layer, or another edit just landed.',
      optionsUnavailable: 'This page has no config API; edit cordis.patch.yml instead.',
      optionsMissing: 'This plugin has no settings namespace here; showing defaults.',
      optionsLoadFailed: 'Failed to read the saved config; showing defaults: {message}',
      optionsFailed: 'Save failed: {message}',
      invalidSteps: 'The step threshold must be an integer of 0 or more.',
      reload: 'Reload',
      save: 'Save',
      saving: 'Saving',
      saved: 'Written to disk',
      dirty: 'Unsaved changes',
      loading: 'Loading…',
      empty: 'The file does not exist yet. Saving creates it.',
      loadFailed: 'Could not read this file',
      saveFailed: 'Could not write this file',
      unavailable: 'The editor API is not available. Disable and enable this plugin, or restart DSH, then refresh.',
      conflict: 'The file changed on disk while you were editing, so this save was not written.',
      useDisk: 'Load the disk version',
      tooLarge: 'The file is over 512 KiB, so this page does not open it. That avoids saving a truncated copy. Edit the path directly.',
      bytes: '{n} bytes',
      editor: 'Rules body',
    }

    function fill(template, params) {
      return String(template).replace(/\{(\w+)\}/g, (_, key) => (params && key in params ? String(params[key]) : ''))
    }

    function translate(t, lang) {
      const table = lang === 'zh' ? zh : en
      if (typeof t !== 'function') return (key, params) => (params ? fill(table[key] ?? key, params) : (table[key] ?? key))
      return (key, params) => {
        const value = t(key, params)
        if (typeof value === 'string' && value !== key) return params && value.includes('{') ? fill(value, params) : value
        const fallback = table[key] ?? key
        return params ? fill(fallback, params) : fallback
      }
    }

    function randomId() {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
      const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
      bytes[6] = (bytes[6] & 15) | 64
      bytes[8] = (bytes[8] & 63) | 128
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
      return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20)
    }

    async function rpc(endpoint, args) {
      const rpcId = randomId()
      const response = await fetch('/api/' + endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'client-request',
          rpcId,
          method: endpoint,
          payload: { args },
        }),
      })
      if (!response.ok) {
        const error = new Error('HTTP ' + response.status)
        error.status = response.status
        throw error
      }
      const body = await response.json()
      if (!body || body.type !== 'server-response' || !body.result) throw new Error('bad response')
      return body.result
    }

    function failureText(tr, result, fallback) {
      if (result && result.ok === false && result.error?.message) return result.error.message
      return fallback
    }

    /** Flatten a settings.describe() answer into namespace rows. */
    function namespaceRows(found) {
      const payload = found?.ok ? found.value : found
      const listed = Array.isArray(payload) ? payload : payload?.namespaces
      if (Array.isArray(listed)) return listed
      if (listed && typeof listed === 'object') {
        return Object.entries(listed).map(([ns, row]) => (
          row && typeof row === 'object' ? { ns, ...row } : { ns, value: row }
        ))
      }
      return []
    }

    /** Find this plugin's row by entry id first, then by its distinctive fields. */
    function findSettingsRow(found) {
      const rows = namespaceRows(found)
      const exact = rows.find((row) => row?.ns === SETTINGS_NS)
      if (exact) return exact
      return rows.find((row) => {
        const value = row?.value && typeof row.value === 'object' ? row.value : row
        return value !== null && typeof value === 'object'
          && (typeof value.maxSilentSteps === 'number' || typeof value.silentReminder === 'string')
      }) ?? null
    }

    /** Normalize a settings.mutate() answer into its section value + revision. */
    function takeView(landed, fallbackRevision) {
      const view = landed?.value
      const value = view?.value && typeof view.value === 'object' && !Array.isArray(view.value) ? view.value : view
      const revision = Number.isFinite(view?.revision) ? view.revision : fallbackRevision
      return { value: value && typeof value === 'object' && !Array.isArray(value) ? value : null, revision }
    }

    function RulesSection(props) {
      const remote = props?.remote
      const lang = String(document.documentElement?.lang || navigator.language || 'zh').toLowerCase().startsWith('zh') ? 'zh' : 'en'
      const tr = translate(props?.t, lang)
      const [phase, setPhase] = useState('loading')
      const [path, setPath] = useState('')
      const [draft, setDraft] = useState('')
      const [saved, setSaved] = useState('')
      const [mtime, setMtime] = useState(0)
      const [bytes, setBytes] = useState(0)
      const [exists, setExists] = useState(true)
      const [busy, setBusy] = useState(false)
      const [note, setNote] = useState(null)
      const area = useRef(null)
      const reminderArea = useRef(null)
      const loopArea = useRef(null)
      const staleArea = useRef(null)
      const request = useRef(0)

      // Settings config state: rules body stays on the file service; the guard
      // options are volatile plugin config edited through the settings remote.
      const [configPhase, setConfigPhase] = useState('loading')
      const [configNs, setConfigNs] = useState(SETTINGS_NS)
      const [revision, setRevision] = useState(0)
      const [stepsDraft, setStepsDraft] = useState('')
      const [reminderDraft, setReminderDraft] = useState('')
      const [optionsBusy, setOptionsBusy] = useState(false)
      const [configNote, setConfigNote] = useState(null)
      const [repeatLimitDraft, setRepeatLimitDraft] = useState('')
      const [repeatActionDraft, setRepeatActionDraft] = useState('remind')
      const [loopReminderDraft, setLoopReminderDraft] = useState('')
      const [staleStepsDraft, setStaleStepsDraft] = useState('')
      const [staleReminderDraft, setStaleReminderDraft] = useState('')

      function applyLoaded(value) {
        setPath(value.path || '')
        setDraft(value.text || '')
        setSaved(value.text || '')
        setMtime(value.mtime || 0)
        setBytes(value.bytes || 0)
        setExists(value.exists !== false)
        setPhase('ready')
      }

      async function load() {
        const ticket = ++request.current
        setBusy(true)
        setNote(null)
        try {
          const result = await rpc(READ, {})
          if (ticket !== request.current) return
          if (result.ok !== true) {
            setPhase('failed')
            setNote({ tone: 'error', text: result.error?.code === 'gateway/invocation-unavailable' ? tr('unavailable') : failureText(tr, result, tr('loadFailed')) })
            return
          }
          const value = result.value
          if (!value || value.ok === false) {
            setPath(value?.path || '')
            setBytes(value?.bytes || 0)
            setMtime(value?.mtime || 0)
            if (value?.code === 'too-large') {
              setPhase('too-large')
              setNote({ tone: 'error', text: tr('tooLarge') })
              return
            }
            setPhase('failed')
            setNote({ tone: 'error', text: value?.message || tr('loadFailed') })
            return
          }
          applyLoaded(value)
        } catch (error) {
          if (ticket !== request.current) return
          setPhase('failed')
          setNote({ tone: 'error', text: error?.status === 404 ? tr('unavailable') : tr('loadFailed') })
        } finally {
          if (ticket === request.current) setBusy(false)
        }
      }

      async function loadConfig() {
        let api
        try {
          api = remote?.settings
        } catch {
          api = undefined
        }
        if (!api || typeof api.describe !== 'function') {
          setConfigPhase('failed')
          setConfigNote({ tone: 'error', text: tr('optionsUnavailable') })
          return
        }
        try {
          const found = await api.describe()
          const row = findSettingsRow(found)
          if (row === null) {
            setConfigPhase('failed')
            setConfigNote({ tone: 'error', text: tr('optionsMissing') })
            return
          }
          const value = row.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}
          setConfigNs(typeof row.ns === 'string' && row.ns ? row.ns : SETTINGS_NS)
          setStepsDraft(Number.isFinite(value.maxSilentSteps) ? String(value.maxSilentSteps) : '')
          setReminderDraft(typeof value.silentReminder === 'string' ? value.silentReminder : '')
          setRepeatLimitDraft(Number.isFinite(value.repeatLimit) && value.repeatLimit > 0 ? String(value.repeatLimit) : '')
          setRepeatActionDraft(value.repeatAction === 'stop' ? 'stop' : 'remind')
          setLoopReminderDraft(typeof value.repeatReminder === 'string' ? value.repeatReminder : '')
          setStaleStepsDraft(Number.isFinite(value.maxStaleTodoSteps) && value.maxStaleTodoSteps > 0 ? String(value.maxStaleTodoSteps) : '')
          setStaleReminderDraft(typeof value.staleTodoReminder === 'string' ? value.staleTodoReminder : '')
          setRevision(Number.isFinite(row.revision) ? row.revision : 0)
          setConfigPhase('ready')
        } catch (error) {
          setConfigPhase('failed')
          setConfigNote({ tone: 'error', text: tr('optionsLoadFailed', { message: error?.message || String(error) }) })
        }
      }

      useEffect(() => {
        load()
        return () => { request.current += 1 }
      }, [])

      useEffect(() => {
        loadConfig()
        return undefined
      }, [])

      // Keep the reminder field tall enough for its whole text (placeholder or
      // value), so a long template wraps instead of being cut off on one line.
      useEffect(() => {
        const element = reminderArea.current
        if (!element) return
        element.style.height = 'auto'
        element.style.height = Math.min(element.scrollHeight, 240) + 'px'
      }, [reminderDraft, configPhase])

      // Same auto-height behaviour for the loop-guard reminder field.
      useEffect(() => {
        const element = loopArea.current
        if (!element) return
        element.style.height = 'auto'
        element.style.height = Math.min(element.scrollHeight, 240) + 'px'
      }, [loopReminderDraft, configPhase])

      async function save() {
        const ticket = ++request.current
        setBusy(true)
        setNote(null)
        try {
          const result = await rpc(WRITE, { text: draft, expectedMtime: mtime })
          if (ticket !== request.current) return
          if (result.ok !== true) {
            setNote({ tone: 'error', text: failureText(tr, result, tr('saveFailed')) })
            return
          }
          const value = result.value
          if (!value || value.ok === false) {
            if (value?.code === 'conflict') {
              setNote({
                tone: 'error',
                text: tr('conflict'),
                disk: typeof value.text === 'string' ? value.text : null,
                mtime: value.mtime,
                bytes: value.bytes,
                exists: value.exists,
                tooLarge: value.tooLarge === true,
              })
              return
            }
            if (value?.code === 'too-large') {
              setNote({ tone: 'error', text: tr('tooLarge') })
              return
            }
            setNote({ tone: 'error', text: value?.message || tr('saveFailed') })
            return
          }
          setSaved(draft)
          setMtime(value.mtime || 0)
          setBytes(value.bytes || 0)
          setExists(true)
          setPath(value.path || path)
          setPhase('ready')
          setNote({ tone: 'ok', text: tr('saved') })
        } catch (error) {
          if (ticket !== request.current) return
          setNote({ tone: 'error', text: error?.status === 404 ? tr('unavailable') : tr('saveFailed') })
        } finally {
          if (ticket === request.current) setBusy(false)
        }
      }

      async function saveGuard() {
        const api = remote?.settings
        if (!api || typeof api.mutate !== 'function') {
          setConfigNote({ tone: 'error', text: tr('optionsUnavailable') })
          return
        }
        const stepsText = stepsDraft.trim()
        let steps = 0
        if (stepsText !== '') {
          steps = Number(stepsText)
          if (!Number.isInteger(steps) || steps < 0) {
            setConfigNote({ tone: 'error', text: tr('invalidSteps') })
            return
          }
        }
        const limitText = repeatLimitDraft.trim()
        let limit = 0
        if (limitText !== '') {
          limit = Number(limitText)
          if (!Number.isInteger(limit) || limit < 0) {
            setConfigNote({ tone: 'error', text: tr('invalidLimit') })
            return
          }
        }
        const reminder = reminderDraft.trim() === '' ? '' : reminderDraft
        const loopReminder = loopReminderDraft.trim() === '' ? '' : loopReminderDraft
        const staleText = staleStepsDraft.trim()
        let staleSteps = 0
        if (staleText !== '') {
          staleSteps = Number(staleText)
          if (!Number.isInteger(staleSteps) || staleSteps < 0) {
            setConfigNote({ tone: 'error', text: tr('invalidSteps') })
            return
          }
        }
        const staleReminder = staleReminderDraft.trim() === '' ? '' : staleReminderDraft
        const action = repeatActionDraft === 'stop' ? 'stop' : 'remind'
        const ops = [
          stepsText === '' ? { op: 'unset', path: ['maxSilentSteps'] } : { op: 'set', path: ['maxSilentSteps'], value: steps },
          reminder === '' ? { op: 'unset', path: ['silentReminder'] } : { op: 'set', path: ['silentReminder'], value: reminder },
          limitText === '' ? { op: 'unset', path: ['repeatLimit'] } : { op: 'set', path: ['repeatLimit'], value: limit },
          action === 'remind' ? { op: 'unset', path: ['repeatAction'] } : { op: 'set', path: ['repeatAction'], value: action },
          loopReminder === '' ? { op: 'unset', path: ['repeatReminder'] } : { op: 'set', path: ['repeatReminder'], value: loopReminder },
          staleText === '' ? { op: 'unset', path: ['maxStaleTodoSteps'] } : { op: 'set', path: ['maxStaleTodoSteps'], value: staleSteps },
          staleReminder === '' ? { op: 'unset', path: ['staleTodoReminder'] } : { op: 'set', path: ['staleTodoReminder'], value: staleReminder },
        ]
        setOptionsBusy(true)
        setConfigNote(null)
        try {
          const landed = await api.mutate(configNs, ops, revision)
          if (landed?.ok === false) {
            setConfigNote({ tone: 'error', text: tr('optionsRejected') })
            return
          }
          const view = takeView(landed, revision)
          setRevision(view.revision)
          if (view.value) {
            setStepsDraft(Number.isFinite(view.value.maxSilentSteps) ? String(view.value.maxSilentSteps) : '')
            setReminderDraft(typeof view.value.silentReminder === 'string' ? view.value.silentReminder : '')
            setRepeatLimitDraft(Number.isFinite(view.value.repeatLimit) && view.value.repeatLimit > 0 ? String(view.value.repeatLimit) : '')
            setRepeatActionDraft(view.value.repeatAction === 'stop' ? 'stop' : 'remind')
            setLoopReminderDraft(typeof view.value.repeatReminder === 'string' ? view.value.repeatReminder : '')
            setStaleStepsDraft(Number.isFinite(view.value.maxStaleTodoSteps) && view.value.maxStaleTodoSteps > 0 ? String(view.value.maxStaleTodoSteps) : '')
            setStaleReminderDraft(typeof view.value.staleTodoReminder === 'string' ? view.value.staleTodoReminder : '')
          }
          setConfigNote({ tone: 'ok', text: tr('guardSaved') })
        } catch (error) {
          setConfigNote({ tone: 'error', text: tr('optionsFailed', { message: error?.message || String(error) }) })
        } finally {
          setOptionsBusy(false)
        }
      }

      function onKeyDown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault()
          if (!busy && draft !== saved) save()
        }
      }

      const dirty = phase === 'ready' && draft !== saved
      const status = []
      if (phase === 'loading') status.push(h('p', { key: 'loading', className: 'dsh-agents-md-hint', role: 'status' }, tr('loading')))
      if (phase === 'too-large') status.push(h('p', { key: 'large', className: 'dsh-agents-md-hint' }, fill(tr('bytes'), { n: bytes })))
      if (note) {
        status.push(h('p', {
          key: 'note',
          className: note.tone === 'ok' ? 'dsh-agents-md-ok' : 'dsh-agents-md-error',
          role: note.tone === 'ok' ? 'status' : 'alert',
        },
        note.text,
        note.disk !== undefined && note.disk !== null ? h('button', {
          type: 'button',
          className: 'dsh-agents-md-button',
          onClick: () => {
            setDraft(note.disk)
            setSaved(note.disk)
            setMtime(note.mtime || 0)
            setBytes(note.bytes || 0)
            setExists(note.exists !== false)
            setPhase('ready')
            setNote(null)
          },
        }, tr('useDisk')) : null))
      }

      const editorBody = [
        phase === 'ready' ? h('textarea', {
          key: 'area',
          ref: area,
          className: 'dsh-agents-md-input',
          value: draft,
          spellCheck: false,
          'aria-label': tr('editor'),
          onChange: (event) => { setDraft(event.target.value); setNote(null) },
          onKeyDown,
        }) : null,
        phase === 'ready' && !exists && draft === '' ? h('p', { key: 'empty', className: 'dsh-agents-md-hint' }, tr('empty')) : null,
        ...status,
      ]

      const editorFooter = h('div', { className: 'dsh-agents-md-row' },
        phase === 'ready' ? h('span', { className: 'dsh-agents-md-meta' },
          fill(tr('bytes'), { n: BufferBytes(draft) }),
          dirty ? ' · ' + tr('dirty') : '') : null,
        h('span', { className: 'dsh-agents-md-actions' },
          h('button', { type: 'button', className: 'dsh-agents-md-button', disabled: busy, onClick: load }, tr('reload')),
          phase === 'ready' ? h('button', {
            type: 'button',
            className: 'dsh-agents-md-primary',
            disabled: busy || !dirty,
            onClick: save,
          }, busy ? tr('saving') : tr('save')) : null))

      const rulesCard = h('div', { className: 'dsh-agents-md-card' },
        h('h3', { className: 'dsh-agents-md-subtitle' }, tr('rulesTitle')),
        path ? h('p', { className: 'dsh-agents-md-path' }, tr('effective'), ' ', h('code', null, path)) : null,
        h('p', { className: 'dsh-agents-md-hint' }, tr('pathHint')),
        ...editorBody,
        editorFooter)

      const guardCard = h('div', { className: 'dsh-agents-md-card' },
        h('h3', { className: 'dsh-agents-md-subtitle' }, tr('guardTitle')),
        h('p', { className: 'dsh-agents-md-group' }, tr('silentTitle')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('guardStepsLabel'),
          h('input', {
            className: 'dsh-agents-md-field',
            type: 'number',
            min: '0',
            step: '1',
            value: stepsDraft,
            disabled: optionsBusy || configPhase !== 'ready',
            onChange: (event) => { setStepsDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('guardStepsHint')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('guardReminderLabel'),
          h('textarea', {
            ref: reminderArea,
            className: 'dsh-agents-md-field dsh-agents-md-field-area',
            rows: 3,
            value: reminderDraft,
            spellCheck: false,
            disabled: optionsBusy || configPhase !== 'ready',
            placeholder: DEFAULT_REMINDER,
            onChange: (event) => { setReminderDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('guardReminderHint')),
        h('p', { className: 'dsh-agents-md-group' }, tr('loopTitle')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('loopLimitLabel'),
          h('input', {
            className: 'dsh-agents-md-field',
            type: 'number',
            min: '0',
            step: '1',
            value: repeatLimitDraft,
            disabled: optionsBusy || configPhase !== 'ready',
            onChange: (event) => { setRepeatLimitDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('loopLimitHint')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('loopActionLabel'),
          h('select', {
            className: 'dsh-agents-md-field',
            value: repeatActionDraft,
            disabled: optionsBusy || configPhase !== 'ready',
            onChange: (event) => { setRepeatActionDraft(event.target.value); setConfigNote(null) },
          },
          h('option', { value: 'remind' }, tr('loopActionRemind')),
          h('option', { value: 'stop' }, tr('loopActionStop')))),
        h('label', { className: 'dsh-agents-md-label' },
          tr('loopReminderLabel'),
          h('textarea', {
            ref: loopArea,
            className: 'dsh-agents-md-field dsh-agents-md-field-area',
            rows: 3,
            value: loopReminderDraft,
            spellCheck: false,
            disabled: optionsBusy || configPhase !== 'ready',
            placeholder: DEFAULT_REPEAT_REMINDER,
            onChange: (event) => { setLoopReminderDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('loopReminderHint')),
        h('p', { className: 'dsh-agents-md-group' }, tr('staleTitle')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('staleStepsLabel'),
          h('input', {
            className: 'dsh-agents-md-field',
            type: 'number',
            min: '0',
            step: '1',
            value: staleStepsDraft,
            disabled: optionsBusy || configPhase !== 'ready',
            onChange: (event) => { setStaleStepsDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('staleStepsHint')),
        h('label', { className: 'dsh-agents-md-label' },
          tr('staleReminderLabel'),
          h('textarea', {
            ref: staleArea,
            className: 'dsh-agents-md-field dsh-agents-md-field-area',
            rows: 3,
            value: staleReminderDraft,
            spellCheck: false,
            disabled: optionsBusy || configPhase !== 'ready',
            placeholder: DEFAULT_STALE_TODO_REMINDER,
            onChange: (event) => { setStaleReminderDraft(event.target.value); setConfigNote(null) },
          })),
        h('p', { className: 'dsh-agents-md-hint' }, tr('staleReminderHint')),
        configNote ? h('p', {
          className: configNote.tone === 'ok' ? 'dsh-agents-md-ok' : 'dsh-agents-md-error',
          role: configNote.tone === 'ok' ? 'status' : 'alert',
        }, configNote.text) : null,
        h('div', { className: 'dsh-agents-md-row' },
          h('span', { className: 'dsh-agents-md-actions' },
            h('button', {
              type: 'button',
              className: 'dsh-agents-md-primary',
              disabled: optionsBusy || configPhase !== 'ready',
              onClick: saveGuard,
            }, optionsBusy ? tr('savingGuard') : tr('saveGuard')))))

      return h('section', { className: 'dsh-agents-md dsh-agents-md-page', 'data-agents-md': 'settings' },
        h('style', null, STYLE),
        h('div', { className: 'dsh-agents-md-stack' },
          h('h2', { className: 'dsh-agents-md-title' }, tr('title')),
          h('p', { className: 'dsh-agents-md-hint' }, tr('settingsIntro')),
          rulesCard,
          guardCard))
    }

    function BufferBytes(text) {
      return new TextEncoder().encode(text).length
    }

    const STYLE = [
      '.dsh-agents-md { margin-top: 16px; color: var(--dsw-alias-label-primary); }',
      '.dsh-agents-md-page { margin-top: 0; }',
      '.dsh-agents-md-stack { display: grid; gap: 16px; }',
      '.dsh-agents-md-card { display: grid; gap: 10px; padding: 16px; border: 0.5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-xl, 20px); background: var(--dsw-alias-bg-layer-2); }',
      '.dsh-agents-md-title { margin: 0; font-size: 16px; line-height: 1.4; font-weight: 600; }',
      '.dsh-agents-md-page > .dsh-agents-md-stack > .dsh-agents-md-title { font-size: 18px; }',
      '.dsh-agents-md-subtitle { margin: 0; font-size: 14px; line-height: 1.4; font-weight: 600; }',
      '.dsh-agents-md-group { margin: 6px 0 0; color: var(--dsw-alias-label-primary); font-size: 13px; font-weight: 600; }',
      '.dsh-agents-md-hint, .dsh-agents-md-path, .dsh-agents-md-meta { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; }',
      '.dsh-agents-md-path { overflow-wrap: anywhere; }',
      '.dsh-agents-md-path code { font-family: var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 12px; }',
      '.dsh-agents-md-label { display: grid; gap: 6px; color: var(--dsw-alias-label-secondary); font-size: 12px; line-height: 1.5; }',
      '.dsh-agents-md-field { box-sizing: border-box; width: 100%; height: 34px; padding: 0 10px; font: inherit; font-size: 13px; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-sm, 8px); }',
      '.dsh-agents-md-field-area { height: auto; min-height: 68px; padding: 8px 10px; line-height: 1.5; resize: vertical; }',
      '.dsh-agents-md-input { box-sizing: border-box; width: 100%; min-height: 280px; resize: vertical; padding: 12px; font: 13px/1.5 var(--dsw-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md, 12px); }',
      '.dsh-agents-md-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }',
      '.dsh-agents-md-actions { display: flex; gap: 8px; margin-left: auto; }',
      '.dsh-agents-md-button, .dsh-agents-md-primary { height: 32px; padding: 0 14px; font: inherit; font-size: 13px; border-radius: var(--dsw-radius-sm, 8px); cursor: pointer; }',
      '.dsh-agents-md-button { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); border: 0.5px solid var(--dsw-alias-border-l2); }',
      '.dsh-agents-md-primary { color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-layer-1)); background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary)); border: 0; }',
      '.dsh-agents-md-button:disabled, .dsh-agents-md-primary:disabled { cursor: default; opacity: 0.55; }',
      '.dsh-agents-md-button:focus-visible, .dsh-agents-md-primary:focus-visible, .dsh-agents-md-input:focus-visible, .dsh-agents-md-field:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color); outline-offset: 2px; }',
      '.dsh-agents-md-error { margin: 0; color: var(--dsw-alias-state-error-primary); font-size: 12px; line-height: 1.5; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }',
      '.dsh-agents-md-ok { margin: 0; color: var(--dsw-alias-state-success-primary); font-size: 12px; line-height: 1.5; }',
      '@media (prefers-reduced-motion: reduce) { .dsh-agents-md-button, .dsh-agents-md-primary { transition: none; } }',
    ].join('\n')

    // Both services are declared so Cordis resolves them before apply runs: reading an
    // undeclared service throws, and one throw used to skip the slot registration below.
    return {
      inject: ['slots', 'remote', 'remote.settings', 'locale'],
      apply(ctx) {
        // Locale copy is a nice-to-have for labels; a failure here must not cost the editor.
        let localized = false
        try {
          if (typeof ctx.locale?.register === 'function' && typeof ctx.effect === 'function') {
            ctx.effect(() => ctx.locale.register('systemAgentsMd', { zh, en }), 'system-agents-md.locale')
            localized = true
          }
        } catch (error) {
          console.warn('[system-agents-md] locale namespace unavailable', error)
        }
        if (typeof ctx.slots?.inject !== 'function' || typeof ctx.slots?.register !== 'function') {
          console.warn('[system-agents-md] slots service unavailable')
          return
        }
        let t
        try {
          t = localized && typeof ctx.locale.bind === 'function' ? ctx.locale.bind('systemAgentsMd') : undefined
        } catch {
          t = undefined
        }
        const localeOption = localized ? { locale: 'systemAgentsMd' } : {}

        // Package detail page: render the same full page as the settings dialog
        // (rules body + silent-step guard), so both entries stay identical.
        const detailOptions = { name: 'plugins.bundle.config', key: PKG, ...localeOption }
        ctx.slots.inject(detailOptions.name, () => {
          try {
            return ctx.slots.register(detailOptions, (props) => RulesSection({ ...props, remote: ctx.remote }))
          } catch (error) {
            console.warn('[system-agents-md] detail section unavailable', error)
            return undefined
          }
        })

        // Settings dialog: its own nav item. The shell declares `settings.section`
        // as a list slot (id/order/label), and columns render lazily on open.
        ctx.slots.inject('settings.section', () => {
          try {
            return ctx.slots.register({
              name: 'settings.section',
              id: 'personal-rules',
              order: 25,
              label: () => (typeof t === 'function' ? t('nav') : '个性化规则'),
              ...localeOption,
              inject: () => ({ remote: ctx.remote }),
            }, (props) => RulesSection({ ...props, remote: ctx.remote }))
          } catch (error) {
            console.warn('[system-agents-md] settings section unavailable', error)
            return undefined
          }
        })
      },
    }
  },
})
