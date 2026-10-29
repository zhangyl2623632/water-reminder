/**
 * Host half of the local drinking-water reminder.
 *
 * Owns the configuration, the local-clock schedule, the single pending
 * reminder, and the durable state file. Two callers reach the same operations:
 * the agent tool (`water_reminder`) and the Client half over a private HTTP
 * route. Nothing leaves this machine.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const STATE_VERSION = 1
const DAY_MS = 24 * 60 * 60 * 1000
const TICK_MS = 1000
const STALE_MS = 15 * 60 * 1000
const MIN_INTERVAL = 5
const MAX_INTERVAL = 480
const ROUTE_PREFIX = '/water-reminder'

const DEFAULTS = { intervalMinutes: 60, start: '09:00', end: '21:00' }

const TEXTS = [
  '⏰ 该喝水啦，小口慢饮，不要一次性猛灌。',
  '💧 抿一口水吧，润润嗓子再继续。',
  '🌿 起身伸个懒腰，顺手喝两口水。',
  '💧 水杯见底了吗？续上，慢慢喝。',
  '🍃 这会儿喝几口，比一次灌一大杯舒服。',
  '⏰ 补水时间到，小口慢饮更舒服。',
  '💧 喝口水，歇三十秒再出发。',
  '💧 别等口渴才喝，现在来几口。',
]

// ---------------------------------------------------------------- time helpers

function pad2(value) {
  return String(value).padStart(2, '0')
}

/** "09:00" -> minutes of day, or null when the text is not a valid clock time. */
function parseClock(value) {
  if (typeof value !== 'string') return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return hour * 60 + minute
}

function formatClock(minutes) {
  return `${pad2(Math.floor(minutes / 60) % 24)}:${pad2(minutes % 60)}`
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function windowSpan(config) {
  const start = parseClock(config.start)
  const end = parseClock(config.end)
  return { start: start === null ? 540 : start, end: end === null ? 1260 : end }
}

/** Inclusive on both edges; a start later than the end means an overnight window. */
function insideWindow(date, config) {
  const { start, end } = windowSpan(config)
  if (start === end) return true
  const minutes = minutesOfDay(date)
  return start < end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end
}

function clockOn(date, minutes) {
  const at = new Date(date)
  at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return at
}

/** First window opening strictly after `date`, in epoch milliseconds. */
function nextWindowStart(date, config) {
  const { start, end } = windowSpan(config)
  const todayStart = clockOn(date, start).getTime()
  const minutes = minutesOfDay(date)
  if (start < end) return minutes < start ? todayStart : todayStart + DAY_MS
  if (start > end) return minutes > end && minutes < start ? todayStart : todayStart + DAY_MS
  return todayStart + DAY_MS
}

function nextDueAt(date, config) {
  if (!insideWindow(date, config)) return nextWindowStart(date, config)
  const candidate = date.getTime() + config.intervalMinutes * 60 * 1000
  // An interval that would land past the window end waits for the next opening
  // instead of scheduling a reminder outside the configured hours.
  const at = new Date(candidate)
  return insideWindow(at, config) ? candidate : nextWindowStart(at, config)
}

function whenLabel(ms, now) {
  const at = new Date(ms)
  const time = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`
  const today = new Date(now)
  if (at.toDateString() === today.toDateString()) return `今天 ${time}`
  const tomorrow = new Date(today.getTime() + DAY_MS)
  if (at.toDateString() === tomorrow.toDateString()) return `明天 ${time}`
  return `${at.getMonth() + 1} 月 ${at.getDate()} 日 ${time}`
}

// --------------------------------------------------------------- state storage

function resolveStatePath() {
  const root = process.env.DSH_PROFILE_DIR || process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(root, 'water-reminder.state.json')
}

/** Previous releases kept the file in the home directory itself. */
function legacyStatePath() {
  return path.join(os.homedir(), 'water-reminder.state.json')
}

function defaultState() {
  return {
    version: STATE_VERSION,
    onboarded: false,
    intervalMinutes: DEFAULTS.intervalMinutes,
    start: DEFAULTS.start,
    end: DEFAULTS.end,
    paused: false,
    nextAt: 0,
    pending: null,
    lastText: '',
    day: '',
    count: 0,
    updatedAt: 0,
  }
}

function normalizeState(raw) {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const interval = Number(raw.intervalMinutes)
  if (Number.isInteger(interval) && interval >= MIN_INTERVAL && interval <= MAX_INTERVAL) {
    base.intervalMinutes = interval
  }
  if (parseClock(raw.start) !== null) base.start = formatClock(parseClock(raw.start))
  if (parseClock(raw.end) !== null) base.end = formatClock(parseClock(raw.end))
  base.onboarded = raw.onboarded === true
  base.paused = raw.paused === true
  base.nextAt = Number.isFinite(Number(raw.nextAt)) ? Number(raw.nextAt) : 0
  base.day = typeof raw.day === 'string' ? raw.day : ''
  base.count = Number.isFinite(Number(raw.count)) ? Math.max(0, Math.trunc(Number(raw.count))) : 0
  base.lastText = typeof raw.lastText === 'string' ? raw.lastText : ''
  const pending = raw.pending
  if (pending && typeof pending === 'object' && typeof pending.id === 'string' && typeof pending.text === 'string') {
    base.pending = {
      id: pending.id.slice(0, 64),
      at: Number.isFinite(Number(pending.at)) ? Number(pending.at) : base.updatedAt,
      text: pending.text.slice(0, 120),
    }
  }
  return base
}

// ---------------------------------------------------------------------- engine

function createEngine() {
  const filePath = resolveStatePath()
  let state = defaultState()
  let ready = false
  let writes = Promise.resolve()
  let sequence = 0

  const newId = () => `wr-${Date.now().toString(36)}-${(sequence++).toString(36)}`

  function pickText() {
    const pool = TEXTS.filter((text) => text !== state.lastText)
    const text = pool[Math.floor(Math.random() * pool.length)] || TEXTS[0]
    state.lastText = text
    return text
  }

  function persist() {
    const payload = JSON.stringify(state, null, 2)
    writes = writes
      .then(() => fs.writeFile(filePath, payload, 'utf8'))
      .catch(() => undefined)
    return writes
  }

  async function readState() {
    try {
      return { raw: await fs.readFile(filePath, 'utf8'), legacy: false }
    } catch (error) {
      if (error && error.code !== 'ENOENT') return null
    }
    const legacy = legacyStatePath()
    if (legacy === filePath) return null
    try {
      return { raw: await fs.readFile(legacy, 'utf8'), legacy: true }
    } catch {
      return null
    }
  }

  async function load() {
    const found = await readState()
    if (found) {
      try {
        state = normalizeState(JSON.parse(found.raw))
      } catch {
        state = defaultState()
      }
    }
    const now = new Date()
    state.day = dayKey(now)
    if (!Number.isFinite(state.nextAt) || state.nextAt <= 0) {
      state.nextAt = nextDueAt(now, state)
    }
    ready = true
    persist()
    if (found && found.legacy) {
      writes = writes.then(() => fs.rm(legacyStatePath(), { force: true })).catch(() => undefined)
    }
  }

  /** One tick of the local clock: at most one pending reminder exists at a time. */
  function tick() {
    if (!ready) return
    const now = new Date()
    let dirty = false
    const today = dayKey(now)
    if (state.day !== today) {
      state.day = today
      state.count = 0
      dirty = true
    }
    if (state.paused) {
      if (state.pending) {
        state.pending = null
        dirty = true
      }
      if (dirty) persist()
      return
    }
    if (!insideWindow(now, state)) {
      // Never surface a reminder outside the configured window.
      if (state.pending) {
        state.pending = null
        dirty = true
      }
      const next = nextWindowStart(now, state)
      if (state.nextAt !== next) {
        state.nextAt = next
        dirty = true
      }
      if (dirty) persist()
      return
    }
    if (state.pending && now.getTime() - state.pending.at > STALE_MS) {
      state.pending = null
      dirty = true
    }
    if (now.getTime() >= state.nextAt) {
      if (!state.pending) {
        state.pending = { id: newId(), at: now.getTime(), text: pickText() }
        state.count += 1
      }
      state.nextAt = nextDueAt(now, state)
      dirty = true
    }
    if (dirty) {
      state.updatedAt = now.getTime()
      persist()
    }
  }

  function snapshot() {
    const now = new Date()
    const inside = insideWindow(now, state)
    const paused = state.paused === true
    const nextAt = paused ? 0 : Math.max(state.nextAt, inside ? 0 : nextWindowStart(now, state))
    return {
      version: STATE_VERSION,
      onboarded: state.onboarded,
      paused,
      intervalMinutes: state.intervalMinutes,
      start: state.start,
      end: state.end,
      nextAt,
      pending: state.pending ? { ...state.pending } : null,
      insideWindow: inside,
      todayCount: state.count,
      day: state.day,
      deviceNow: now.getTime(),
    }
  }

  function summary() {
    const view = snapshot()
    const now = new Date()
    const lines = []
    if (view.paused) lines.push('状态：已暂停（配置已保留，说“继续”可恢复）')
    else if (!view.insideWindow) lines.push('状态：等待中（当前不在提醒时段）')
    else lines.push('状态：提醒中')
    lines.push(`下次提醒：${view.nextAt ? whenLabel(view.nextAt, now) : '暂停中'}`)
    lines.push(`提醒时段：${view.start}–${view.end}`)
    lines.push(`提醒间隔：每 ${view.intervalMinutes} 分钟`)
    lines.push(`今日已提醒：${view.todayCount} 次`)
    return lines.join('\n')
  }

  function configure(input) {
    const patch = {}
    if (input && input.intervalMinutes !== undefined && input.intervalMinutes !== null) {
      const interval = Number(input.intervalMinutes)
      if (!Number.isInteger(interval) || interval < MIN_INTERVAL || interval > MAX_INTERVAL) {
        return { ok: false, error: `间隔需要是 ${MIN_INTERVAL}–${MAX_INTERVAL} 之间的整分钟数。` }
      }
      patch.intervalMinutes = interval
    }
    for (const field of ['start', 'end']) {
      if (input && input[field] !== undefined && input[field] !== null) {
        const minutes = parseClock(input[field])
        if (minutes === null) return { ok: false, error: `时间「${input[field]}」看不懂，请用 HH:MM，例如 09:00。` }
        patch[field] = formatClock(minutes)
      }
    }
    const merged = { ...state, ...patch }
    if (parseClock(merged.start) === parseClock(merged.end)) {
      return { ok: false, error: '开始时间和结束时间不能相同。' }
    }
    state = { ...state, ...patch, onboarded: true, pending: null, paused: false }
    state.nextAt = nextDueAt(new Date(), state)
    state.updatedAt = Date.now()
    persist()
    return { ok: true }
  }

  function dispatch(action, payload) {
    const now = new Date()
    switch (action) {
      case 'status':
        break
      case 'configure': {
        const result = configure(payload)
        if (!result.ok) return result
        break
      }
      case 'pause':
        state.paused = true
        state.pending = null
        state.updatedAt = now.getTime()
        persist()
        break
      case 'resume':
        state.paused = false
        state.pending = null
        state.nextAt = nextDueAt(now, state)
        state.updatedAt = now.getTime()
        persist()
        break
      case 'reset':
        state = { ...defaultState(), onboarded: true, day: dayKey(now) }
        state.nextAt = nextDueAt(now, state)
        state.updatedAt = now.getTime()
        persist()
        break
      case 'ack': {
        const id = payload && typeof payload.id === 'string' ? payload.id : ''
        if (state.pending && (!id || state.pending.id === id)) {
          state.pending = null
          state.updatedAt = now.getTime()
          persist()
        }
        break
      }
      case 'preview':
        state.paused = false
        if (!insideWindow(now, state)) {
          return { ok: false, error: `现在不在提醒时段（${state.start}–${state.end}），预览请先调整时段。` }
        }
        state.onboarded = true
        state.pending = { id: newId(), at: now.getTime(), text: pickText() }
        if (state.day !== dayKey(now)) {
          state.day = dayKey(now)
          state.count = 0
        }
        if (!state.nextAt || state.nextAt <= now.getTime()) {
          state.nextAt = nextDueAt(now, state)
        }
        state.updatedAt = now.getTime()
        persist()
        break
      case 'onboarded':
        state.onboarded = true
        if (!state.nextAt || state.nextAt <= now.getTime()) state.nextAt = nextDueAt(now, state)
        state.updatedAt = now.getTime()
        persist()
        break
      default:
        return { ok: false, error: `未知操作：${String(action)}` }
    }
    return { ok: true, state: snapshot(), summary: summary() }
  }

  return {
    load,
    tick,
    persist,
    snapshot,
    summary,
    dispatch,
    startClock() {
      const handle = setInterval(tick, TICK_MS)
      if (handle && typeof handle.unref === 'function') handle.unref()
      return () => clearInterval(handle)
    },
  }
}

// ------------------------------------------------------------------------ http

function sendJson(res, status, body) {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(text))
  res.end(text)
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve) => {
    const chunks = []
    let size = 0
    let settled = false
    const done = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        done(null)
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (!chunks.length) return done({})
      try {
        done(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        done(null)
      }
    })
    req.on('error', () => done(null))
  })
}

function createHttpHandler(engine) {
  return async (req, res) => {
    const pathname = (req.url || '').split('?')[0]
    if (pathname === `${ROUTE_PREFIX}/state` && (req.method === 'GET' || req.method === 'HEAD')) {
      sendJson(res, 200, { ok: true, state: engine.snapshot() })
      return
    }
    if (pathname === `${ROUTE_PREFIX}/action` && req.method === 'POST') {
      const body = await readJsonBody(req)
      if (!body || typeof body !== 'object') {
        sendJson(res, 400, { ok: false, error: 'invalid body' })
        return
      }
      const result = engine.dispatch(String(body.action || ''), body)
      if (!result.ok) {
        sendJson(res, 400, { ok: false, error: result.error })
        return
      }
      sendJson(res, 200, { ok: true, state: engine.snapshot(), summary: engine.summary() })
      return
    }
    sendJson(res, 404, { ok: false, error: 'not found' })
  }
}

// ------------------------------------------------------------------------ tool

function createTool(engine) {
  return {
    name: 'water_reminder',
    description: [
      'Local drinking-water reminder running on this device. It is already scheduled: every 60 minutes between 09:00 and 21:00 by default, and it pops one short, gentle reminder inside the app at each due time.',
      'Map the user\'s control commands to actions: 暂停 / 停止提醒 -> pause; 继续 / 恢复 -> resume; 修改间隔 N 分钟 -> configure with interval_minutes; 修改时段 09:00–21:00 -> configure with start and end; 重置默认 -> reset; 查看设置 / 现在什么设置 -> status.',
      'Reply in the user\'s language with one short confirmation line; do not pad it with extra advice or health talk unless the user asks. Times are 24-hour HH:MM on the device clock.',
      'Only use preview when the user asks to see a reminder sample right now.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'configure', 'pause', 'resume', 'reset', 'preview'],
          description: 'status reads the current settings; configure changes interval and/or window; pause keeps settings but stops reminders; resume restarts the timer from now; reset restores 60 minutes and 09:00–21:00; preview shows one reminder immediately.',
        },
        interval_minutes: {
          type: 'integer',
          minimum: MIN_INTERVAL,
          maximum: MAX_INTERVAL,
          description: 'New reminder period in minutes (5–480). Only for configure.',
        },
        start: {
          type: 'string',
          description: 'Window start as HH:MM, 24-hour local time. Only for configure.',
        },
        end: {
          type: 'string',
          description: 'Window end as HH:MM, 24-hour local time. Only for configure.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          summary: { type: 'string' },
        },
        required: ['ok', 'summary'],
        additionalProperties: false,
      },
      render(_args, value) {
        const text = value && typeof value.summary === 'string' ? value.summary : ''
        return [{ type: 'text', text }]
      },
    },
    async execute(args) {
      const input = args && typeof args === 'object' ? args : {}
      const result = engine.dispatch(String(input.action || 'status'), {
        intervalMinutes: input.interval_minutes,
        start: input.start,
        end: input.end,
      })
      if (!result.ok) return { ok: false, summary: result.error }
      return { ok: true, summary: result.summary }
    },
  }
}

// ---------------------------------------------------------------------- plugin

export const inject = ['tools']

export function apply(ctx) {
  const engine = createEngine()

  ctx.effect(() => {
    void engine.load()
    return engine.startClock()
  })

  ctx.effect(() => ctx.tools.register(createTool(engine)))

  // The browser half polls this route. Without a web server there is no page to
  // show a reminder in, so the plugin simply keeps its state and tool.
  const mountRoute = (scope) => {
    scope.effect(() =>
      scope.webServer.register({
        kind: 'prefix',
        path: ROUTE_PREFIX,
        handler: createHttpHandler(engine),
      }),
    )
  }
  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => mountRoute(scope))
  }
}
