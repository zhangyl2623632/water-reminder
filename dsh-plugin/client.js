/**
 * Browser half of the local drinking-water reminder.
 *
 * Renders three seats: the frame-wide reminder card, the Settings page, and a
 * status pill under the composer. All state lives in the Host half; this module
 * polls it once a second while the page is visible and shows at most one
 * reminder at a time.
 */
window.__ModuleLoader__.load({
  id: '@local/water-reminder',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'water-reminder'
    const API = 'water-reminder'
    const DAY_MS = 24 * 60 * 60 * 1000

    const EN = {
      title: 'Water reminder',
      lede: 'One short reminder at a time. Nothing pops outside your window.',
      status: 'Status',
      statusActive: 'Reminding',
      statusPaused: 'Paused',
      statusOutside: 'Outside hours',
      next: 'Next',
      pausedWord: 'Paused',
      window: 'Window',
      every: 'Every',
      minutes: 'min',
      today: 'Today',
      times: 'times',
      save: 'Save',
      saved: 'Saved',
      pause: 'Pause',
      resume: 'Resume',
      reset: 'Reset defaults',
      preview: 'Preview',
      previewHint: 'Show one reminder right now',
      notif: 'System notifications',
      notifOn: 'Enabled',
      notifBlocked: 'Blocked by the browser',
      notifOff: 'Off',
      enable: 'Enable',
      noteBackground:
        'Timing uses this device\u2019s local clock. Reminders arrive while the app keeps running in the background; if the system kills the app, they stop until it runs again.',
      notePrivacy: 'Settings and history stay on this device. Nothing is uploaded or synced.',
      offline: 'Cannot reach the local reminder service. Retrying\u2026',
      onboardTitle: 'Set your water rhythm',
      onboardBody: 'Default: every 60 minutes, 09:00\u201321:00.',
      useDefaults: 'Use defaults',
      confirm: 'Got it, drinking up',
      startLabel: 'Start',
      endLabel: 'End',
      intervalLabel: 'Every',
      tomorrow: 'Tomorrow',
      todayWord: 'Today',
      dismiss: 'Dismiss',
    }

    const ZH = {
      title: '喝水提醒',
      lede: '一次只弹一条，不在时段内绝不打扰。',
      status: '状态',
      statusActive: '提醒中',
      statusPaused: '已暂停',
      statusOutside: '不在时段内',
      next: '下次',
      pausedWord: '暂停中',
      window: '提醒时段',
      every: '提醒间隔',
      minutes: '分钟',
      today: '今日已提醒',
      times: '次',
      save: '保存',
      saved: '已保存',
      pause: '暂停提醒',
      resume: '继续提醒',
      reset: '恢复默认',
      preview: '预览一条',
      previewHint: '立刻弹一条，看看效果',
      notif: '系统通知',
      notifOn: '已开启',
      notifBlocked: '已被浏览器拦截',
      notifOff: '未开启',
      enable: '开启',
      noteBackground:
        '计时使用设备本地时钟。APP 在后台正常运行时可以按时提醒；如果系统清掉后台进程，提醒会停止，重新打开后继续。',
      notePrivacy: '配置与记录只保存在本机，不上传、不联网同步。',
      offline: '连不上本地提醒服务，正在重试…',
      onboardTitle: '先定个喝水节奏',
      onboardBody: '默认每 60 分钟，09:00–21:00。想改就现在改，不改直接用默认。',
      useDefaults: '就用默认',
      confirm: '收到，这就喝',
      startLabel: '开始',
      endLabel: '结束',
      intervalLabel: '间隔',
      tomorrow: '明天',
      todayWord: '今天',
      dismiss: '知道啦',
    }

    const CSS = `
.wr-layer{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:10px;padding:0 16px calc(18px + env(safe-area-inset-bottom,0px));pointer-events:none;z-index:60}
.wr-card{pointer-events:auto;width:min(100%,430px);background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;padding:14px 16px;color:var(--dsw-alias-label-primary);font-size:13px;line-height:1.55;animation:wr-rise .26s cubic-bezier(.2,.8,.2,1)}
.wr-card-head{display:flex;align-items:flex-start;gap:11px}
.wr-glyph{font-size:17px;line-height:1.35;flex:none}
.wr-body{flex:1;min-width:0}
.wr-text{margin:0}
.wr-sub{margin:5px 0 0;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.wr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}
.wr-btn{appearance:none;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-primary);border-radius:9px;padding:5px 12px;font:inherit;font-size:12.5px;line-height:1.5;cursor:pointer;white-space:nowrap}
.wr-btn:hover{background:var(--dsw-alias-bg-layer-2)}
.wr-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.wr-btn:disabled{opacity:.45;cursor:default}
.wr-btn-primary{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.wr-btn-ghost{border-color:transparent;color:var(--dsw-alias-label-secondary);padding-left:6px;padding-right:6px}
.wr-btn-ghost:hover{color:var(--dsw-alias-label-primary)}
.wr-fields{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.wr-field{display:flex;flex-direction:column;gap:4px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.wr-input{font:inherit;font-size:13px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:5px 8px;min-width:0;width:92px}
.wr-input:focus{outline:none;border-color:var(--dsw-alias-brand-primary)}
.wr-page{display:flex;flex-direction:column;gap:12px;max-width:580px;font-size:13px;color:var(--dsw-alias-label-primary)}
.wr-block{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:6px 16px}
.wr-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0}
.wr-row + .wr-row{border-top:1px solid var(--dsw-alias-border-l1)}
.wr-k{color:var(--dsw-alias-label-secondary);font-size:12.5px}
.wr-v{font-size:13px;font-variant-numeric:tabular-nums;text-align:right}
.wr-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:1px}
.wr-dot-on{background:var(--dsw-alias-state-success-primary)}
.wr-dot-paused{background:var(--dsw-alias-state-warn-primary)}
.wr-dot-idle{background:var(--dsw-alias-state-idle-primary)}
.wr-lede{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;line-height:1.6}
.wr-note{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.65;padding:0 2px}
.wr-banner{border-radius:10px;border:1px solid var(--dsw-alias-state-warn-primary);color:var(--dsw-alias-state-warn-primary);padding:8px 12px;font-size:12px}
.wr-pill{display:inline-flex;align-items:center;gap:7px;padding:2px 6px 2px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;font-size:11.5px;line-height:1.7;color:var(--dsw-alias-label-secondary);background:transparent;white-space:nowrap}
.wr-pill-btn{appearance:none;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;padding:0 4px;border-radius:5px;line-height:1.6}
.wr-pill-btn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.wr-pill-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
@keyframes wr-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion: reduce){.wr-card{animation:none}}
`

    // ------------------------------------------------------------- utilities

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function timeOfDay(ms) {
      const at = new Date(ms)
      return `${pad2(at.getHours())}:${pad2(at.getMinutes())}`
    }

    function whenText(ms, t) {
      const at = new Date(ms)
      const now = new Date()
      if (at.toDateString() === now.toDateString()) return `${t('todayWord')} ${timeOfDay(ms)}`
      if (at.toDateString() === new Date(now.getTime() + DAY_MS).toDateString()) {
        return `${t('tomorrow')} ${timeOfDay(ms)}`
      }
      return `${at.getMonth() + 1}/${at.getDate()} ${timeOfDay(ms)}`
    }

    function statusOf(state) {
      if (state.paused) return 'paused'
      return state.insideWindow ? 'active' : 'outside'
    }

    function styles() {
      return h('style', { key: 'wr-style' }, CSS)
    }

    // -------------------------------------------------------------- transport

    function createStore() {
      let snapshot = {
        ready: false,
        online: false,
        busy: false,
        error: '',
        notice: '',
        state: null,
        dismissedId: null,
        notif: typeof window !== 'undefined' && window.Notification ? window.Notification.permission : 'unsupported',
      }
      const listeners = new Set()
      let refreshing = false

      function emit(patch) {
        snapshot = Object.assign({}, snapshot, patch)
        for (const listener of Array.from(listeners)) {
          try {
            listener()
          } catch (error) {
            void error
          }
        }
      }

      function endpoint(name) {
        try {
          return new URL(`${API}/${name}`, document.baseURI).toString()
        } catch (error) {
          return `${API}/${name}`
        }
      }

      async function refresh() {
        if (refreshing) return
        refreshing = true
        try {
          const response = await fetch(endpoint('state'), {
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const data = await response.json()
          if (!data || !data.state) throw new Error('unexpected payload')
          emit({ ready: true, online: true, error: '', state: data.state })
        } catch (error) {
          emit({ ready: true, online: false, error: String((error && error.message) || error) })
        } finally {
          refreshing = false
        }
      }

      async function act(action, payload) {
        emit({ busy: true, notice: '' })
        try {
          const response = await fetch(endpoint('action'), {
            method: 'POST',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(Object.assign({ action }, payload || {})),
          })
          const data = await response.json().catch(() => null)
          if (!response.ok || !data || data.ok !== true) {
            emit({
              busy: false,
              notice: (data && data.error) || `HTTP ${response.status}`,
              online: true,
            })
            return false
          }
          emit({ busy: false, online: true, error: '', notice: '', state: data.state })
          return true
        } catch (error) {
          emit({ busy: false, online: false, error: String((error && error.message) || error) })
          return false
        }
      }

      return {
        get: () => snapshot,
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        refresh,
        act,
        dismiss(id) {
          if (!id) return
          emit({ dismissedId: id })
          void act('ack', { id })
        },
        async requestNotifications() {
          if (typeof window === 'undefined' || !window.Notification) return
          try {
            const result = await window.Notification.requestPermission()
            emit({ notif: result })
          } catch (error) {
            void error
          }
        },
      }
    }

    function useStore(store) {
      const [snapshot, setSnapshot] = React.useState(store.get())
      React.useEffect(() => store.subscribe(() => setSnapshot(store.get())), [store])
      return snapshot
    }

    function notifySystem(text) {
      try {
        if (typeof window === 'undefined' || !window.Notification) return
        if (window.Notification.permission !== 'granted') return
        const note = new window.Notification('💧 该喝水啦', {
          body: text,
          tag: 'water-reminder',
          silent: false,
        })
        window.setTimeout(() => {
          try {
            note.close()
          } catch (error) {
            void error
          }
        }, 30000)
        note.onclick = () => {
          try {
            window.focus()
            note.close()
          } catch (error) {
            void error
          }
        }
      } catch (error) {
        void error
      }
    }

    // -------------------------------------------------------------- the shell

    return {
      inject: ['slots'],
      apply(ctx) {
        const store = createStore()

        let translate = null
        const locale = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
        if (locale && typeof locale.register === 'function') {
          for (const id of ['en', 'zh', 'zh-CN', 'zh-Hans']) {
            try {
              locale.register(NS, id, id === 'en' ? EN : ZH)
            } catch (error) {
              void error
            }
          }
          try {
            translate = locale.bind(NS)
          } catch (error) {
            translate = null
          }
        }
        const t = (key) => {
          let value = key
          if (translate) {
            try {
              value = translate(key)
            } catch (error) {
              value = key
            }
          }
          return value === key && ZH[key] !== undefined ? ZH[key] : value
        }

        // ------------------------------------------------------------ polling

        ctx.effect(() => {
          let alive = true
          let timer = null
          const delay = () => (document.visibilityState === 'hidden' ? 4000 : 1000)
          const loop = async () => {
            if (!alive) return
            await store.refresh()
            if (!alive) return
            timer = window.setTimeout(loop, delay())
          }
          const onVisibility = () => {
            if (document.visibilityState === 'visible') void store.refresh()
          }
          void loop()
          document.addEventListener('visibilitychange', onVisibility)
          return () => {
            alive = false
            if (timer) window.clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisibility)
          }
        })

        // ------------------------------------------------------------- seats

        function ReminderCard() {
          const snapshot = useStore(store)
          const state = snapshot.state
          const pending = state ? state.pending : null
          const visible = Boolean(pending && state && state.onboarded && pending.id !== snapshot.dismissedId)

          React.useEffect(() => {
            if (!visible || !pending) return undefined
            const id = pending.id
            const timer = window.setTimeout(() => store.dismiss(id), 120000)
            notifySystem(pending.text)
            return () => window.clearTimeout(timer)
          }, [visible, pending ? pending.id : ''])

          if (!visible) return null
          return h(
            'div',
            { className: 'wr-layer', role: 'status', 'aria-live': 'polite' },
            h(
              'div',
              { className: 'wr-card', 'data-water-reminder': 'card' },
              h(
                'div',
                { className: 'wr-card-head' },
                h('span', { className: 'wr-glyph', 'aria-hidden': 'true' }, '💧'),
                h(
                  'div',
                  { className: 'wr-body' },
                  h('p', { className: 'wr-text' }, pending.text),
                  h('p', { className: 'wr-sub' }, `${t('every')} ${state.intervalMinutes} ${t('minutes')} · ${state.start}–${state.end}`),
                ),
              ),
              h(
                'div',
                { className: 'wr-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn wr-btn-primary',
                    onClick: () => store.dismiss(pending.id),
                  },
                  t('confirm'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn wr-btn-ghost',
                    onClick: () => void store.act('pause'),
                  },
                  t('pause'),
                ),
              ),
            ),
          )
        }

        function SetupCard() {
          const snapshot = useStore(store)
          const state = snapshot.state
          const [interval, setIntervalValue] = React.useState('')
          const [start, setStart] = React.useState('')
          const [end, setEnd] = React.useState('')

          React.useEffect(() => {
            if (!state) return
            setIntervalValue(String(state.intervalMinutes))
            setStart(state.start)
            setEnd(state.end)
          }, [state && state.intervalMinutes, state && state.start, state && state.end])

          if (!state || state.onboarded) return null
          const save = () =>
            void store.act('configure', {
              intervalMinutes: Number(interval),
              start,
              end,
            })
          return h(
            'div',
            { className: 'wr-layer' },
            h(
              'div',
              { className: 'wr-card', 'data-water-reminder': 'setup', role: 'dialog', 'aria-label': t('onboardTitle') },
              h(
                'div',
                { className: 'wr-card-head' },
                h('span', { className: 'wr-glyph', 'aria-hidden': 'true' }, '🌿'),
                h(
                  'div',
                  { className: 'wr-body' },
                  h('p', { className: 'wr-text' }, h('strong', null, t('onboardTitle'))),
                  h('p', { className: 'wr-sub' }, t('onboardBody')),
                ),
              ),
              h(
                'div',
                { className: 'wr-fields' },
                h(
                  'label',
                  { className: 'wr-field' },
                  t('intervalLabel'),
                  h('input', {
                    className: 'wr-input',
                    type: 'number',
                    min: 5,
                    max: 480,
                    step: 5,
                    value: interval,
                    onChange: (event) => setIntervalValue(event.target.value),
                  }),
                ),
                h(
                  'label',
                  { className: 'wr-field' },
                  t('startLabel'),
                  h('input', {
                    className: 'wr-input',
                    type: 'time',
                    value: start,
                    onChange: (event) => setStart(event.target.value),
                  }),
                ),
                h(
                  'label',
                  { className: 'wr-field' },
                  t('endLabel'),
                  h('input', {
                    className: 'wr-input',
                    type: 'time',
                    value: end,
                    onChange: (event) => setEnd(event.target.value),
                  }),
                ),
              ),
              snapshot.notice ? h('p', { className: 'wr-sub' }, snapshot.notice) : null,
              h(
                'div',
                { className: 'wr-actions' },
                h('button', { type: 'button', className: 'wr-btn wr-btn-primary', disabled: snapshot.busy, onClick: save }, t('save')),
                h(
                  'button',
                  { type: 'button', className: 'wr-btn wr-btn-ghost', disabled: snapshot.busy, onClick: () => void store.act('onboarded') },
                  t('useDefaults'),
                ),
              ),
            ),
          )
        }

        function OverlayView() {
          return h(React.Fragment, null, styles(), h(SetupCard), h(ReminderCard))
        }

        function SettingsView() {
          const snapshot = useStore(store)
          const state = snapshot.state
          const [interval, setIntervalValue] = React.useState('')
          const [start, setStart] = React.useState('')
          const [end, setEnd] = React.useState('')

          React.useEffect(() => {
            if (!state) return
            setIntervalValue(String(state.intervalMinutes))
            setStart(state.start)
            setEnd(state.end)
          }, [state && state.intervalMinutes, state && state.start, state && state.end])

          const status = state ? statusOf(state) : 'idle'
          const dirty = Boolean(
            state && (Number(interval) !== state.intervalMinutes || start !== state.start || end !== state.end),
          )
          const rows = []
          if (state) {
            rows.push(
              h(
                'div',
                { className: 'wr-row', key: 'status' },
                h('span', { className: 'wr-k' }, t('status')),
                h(
                  'span',
                  { className: 'wr-v' },
                  h('span', {
                    className: `wr-dot wr-dot-${status === 'active' ? 'on' : status === 'paused' ? 'paused' : 'idle'}`,
                  }),
                  status === 'active' ? t('statusActive') : status === 'paused' ? t('statusPaused') : t('statusOutside'),
                ),
              ),
            )
            rows.push(
              h(
                'div',
                { className: 'wr-row', key: 'next' },
                h('span', { className: 'wr-k' }, t('next')),
                h('span', { className: 'wr-v' }, status === 'paused' ? t('pausedWord') : whenText(state.nextAt, t)),
              ),
            )
            rows.push(
              h(
                'div',
                { className: 'wr-row', key: 'window' },
                h('span', { className: 'wr-k' }, t('window')),
                h('span', { className: 'wr-v' }, `${state.start}–${state.end}`),
              ),
            )
            rows.push(
              h(
                'div',
                { className: 'wr-row', key: 'every' },
                h('span', { className: 'wr-k' }, t('every')),
                h('span', { className: 'wr-v' }, `${state.intervalMinutes} ${t('minutes')}`),
              ),
            )
            rows.push(
              h(
                'div',
                { className: 'wr-row', key: 'today' },
                h('span', { className: 'wr-k' }, t('today')),
                h('span', { className: 'wr-v' }, `${state.todayCount} ${t('times')}`),
              ),
            )
          }

          return h(
            React.Fragment,
            null,
            styles(),
            h(
              'div',
              { className: 'wr-page', 'data-water-reminder': 'settings' },
              h('p', { className: 'wr-lede' }, t('lede')),
              !snapshot.online
                ? h('div', { className: 'wr-banner' }, snapshot.error ? `${t('offline')} (${snapshot.error})` : t('offline'))
                : null,
              state ? h('div', { className: 'wr-block' }, rows) : null,
              h(
                'div',
                { className: 'wr-block' },
                h(
                  'div',
                  { className: 'wr-row' },
                  h('span', { className: 'wr-k' }, t('intervalLabel')),
                  h('input', {
                    className: 'wr-input',
                    type: 'number',
                    min: 5,
                    max: 480,
                    step: 5,
                    value: interval,
                    onChange: (event) => setIntervalValue(event.target.value),
                  }),
                ),
                h(
                  'div',
                  { className: 'wr-row' },
                  h('span', { className: 'wr-k' }, t('startLabel')),
                  h('input', {
                    className: 'wr-input',
                    type: 'time',
                    value: start,
                    onChange: (event) => setStart(event.target.value),
                  }),
                ),
                h(
                  'div',
                  { className: 'wr-row' },
                  h('span', { className: 'wr-k' }, t('endLabel')),
                  h('input', {
                    className: 'wr-input',
                    type: 'time',
                    value: end,
                    onChange: (event) => setEnd(event.target.value),
                  }),
                ),
              ),
              h(
                'div',
                { className: 'wr-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn wr-btn-primary',
                    disabled: !dirty || snapshot.busy,
                    onClick: () =>
                      void store.act('configure', {
                        intervalMinutes: Number(interval),
                        start,
                        end,
                      }),
                  },
                  dirty ? t('save') : t('saved'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn',
                    disabled: snapshot.busy,
                    onClick: () => void store.act(state && state.paused ? 'resume' : 'pause'),
                  },
                  state && state.paused ? t('resume') : t('pause'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn',
                    disabled: snapshot.busy,
                    title: t('previewHint'),
                    onClick: () => void store.act('preview'),
                  },
                  t('preview'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'wr-btn wr-btn-ghost',
                    disabled: snapshot.busy,
                    onClick: () => void store.act('reset'),
                  },
                  t('reset'),
                ),
              ),
              snapshot.notice ? h('div', { className: 'wr-banner' }, snapshot.notice) : null,
              h(
                'div',
                { className: 'wr-block' },
                h(
                  'div',
                  { className: 'wr-row' },
                  h('span', { className: 'wr-k' }, t('notif')),
                  h(
                    'span',
                    { className: 'wr-v' },
                    snapshot.notif === 'granted'
                      ? t('notifOn')
                      : snapshot.notif === 'denied'
                        ? t('notifBlocked')
                        : snapshot.notif === 'unsupported'
                          ? t('notifOff')
                          : h(
                              'button',
                              {
                                type: 'button',
                                className: 'wr-btn',
                                onClick: () => void store.requestNotifications(),
                              },
                              t('enable'),
                            ),
                  ),
                ),
              ),
              h('p', { className: 'wr-note' }, t('noteBackground')),
              h('p', { className: 'wr-note' }, t('notePrivacy')),
            ),
          )
        }

        function StatusPill() {
          const snapshot = useStore(store)
          const state = snapshot.state
          if (!state) return null
          const status = statusOf(state)
          const label =
            status === 'paused'
              ? t('statusPaused')
              : status === 'outside'
                ? t('statusOutside')
                : `${t('next')} ${timeOfDay(state.nextAt)}`
          return h(
            React.Fragment,
            null,
            styles(),
            h(
              'span',
              { className: 'wr-pill', 'data-water-reminder': 'pill' },
              h('span', {
                className: `wr-dot wr-dot-${status === 'active' ? 'on' : status === 'paused' ? 'paused' : 'idle'}`,
              }),
              h('span', null, `💧 ${label}`),
              h(
                'button',
                {
                  type: 'button',
                  className: 'wr-pill-btn',
                  title: status === 'paused' ? t('resume') : t('pause'),
                  'aria-label': status === 'paused' ? t('resume') : t('pause'),
                  onClick: () => void store.act(status === 'paused' ? 'resume' : 'pause'),
                },
                status === 'paused' ? '▶' : '⏸',
              ),
            ),
          )
        }

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'water-reminder.overlay', order: 30 }, OverlayView),
        )
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'water-reminder', order: 30, label: () => t('title') },
            SettingsView,
          ),
        )
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register({ name: 'conversation.composer.dock', id: 'water-reminder.status', order: 6 }, StatusPill),
        )
      },
    }
  },
})
