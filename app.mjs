import { PG_VERSION, modules, levels, questions } from './questions.mjs'
import { createAttempt, finishAttempt, readState, storageKey } from './assessment.mjs'
import { ui, modulesEn, levelsEn, questionsEn } from './i18n.mjs'

const main = document.querySelector('main')
const confirmation = document.querySelector('#confirmation')
const themeToggle = document.querySelector('#theme-toggle')
const langToggle = document.querySelector('#lang-toggle')
const themeStorageKey = 'knowpg.theme'
const langStorageKey = 'knowpg.lang'
const letters = ['A', 'B', 'C', 'D']

const dateFormats = {
  zh: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }),
  en: new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
}

let lang = (() => {
  try {
    return localStorage.getItem(langStorageKey) === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
})()

let state
let storageErrorKey = ''
let activeModuleId = modules[0].id
let reviewFilter = 'all'
let statusFilter = 'all'
let allExpanded = false
let submissionId
let previousRoute

const t = () => ui[lang]

function locModule(mod) {
  if (lang === 'en' && modulesEn[mod.id])
    return { ...mod, ...modulesEn[mod.id] }
  return { ...mod, shortName: mod.name }
}

function locLevel(level) {
  if (lang === 'en' && levelsEn[level.id])
    return { ...level, ...levelsEn[level.id] }
  return { ...level, short: level.name.slice(0, 2) }
}

function locQuestion(item) {
  if (lang === 'en' && questionsEn[item.id]) {
    const en = questionsEn[item.id]
    return {
      ...item,
      topic: en.topic,
      prompt: en.prompt,
      options: en.options,
      explanation: en.explanation,
      source: en.sourceLabel ? { ...item.source, label: en.sourceLabel } : item.source,
    }
  }
  return item
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function syncThemeColor() {
  const isDark = document.documentElement.dataset.theme === 'dark'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta)
    meta.setAttribute('content', isDark ? '#0f1318' : '#faf8f5')
}

function syncChrome() {
  const dict = t()
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  document.title = dict.docTitle
  const skip = document.querySelector('.skip-link')
  if (skip) skip.textContent = dict.skipLink
  if (themeToggle) {
    themeToggle.setAttribute('aria-label', dict.themeToggle)
    themeToggle.title = dict.themeToggle
  }
  if (langToggle) {
    langToggle.textContent = dict.langButton
    langToggle.setAttribute('aria-label', dict.langToggle)
    langToggle.title = dict.langToggle
  }
  const footerRight = document.querySelector('#footer-right')
  if (footerRight) footerRight.textContent = dict.footerRight
  const confirmTitle = document.querySelector('#confirm-title')
  if (confirmTitle) confirmTitle.textContent = dict.confirmTitle
  const confirmCancel = document.querySelector('#confirm-cancel')
  if (confirmCancel) confirmCancel.textContent = dict.confirmCancel
  const confirmSubmit = document.querySelector('#confirm-submit')
  if (confirmSubmit) confirmSubmit.textContent = dict.confirmSubmit
}

themeToggle?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
  document.documentElement.dataset.theme = next
  syncThemeColor()
  try {
    localStorage.setItem(themeStorageKey, next)
  } catch {}
})
syncThemeColor()

langToggle?.addEventListener('click', () => {
  lang = lang === 'zh' ? 'en' : 'zh'
  try {
    localStorage.setItem(langStorageKey, lang)
  } catch {}
  syncChrome()
  render()
})

function refreshState() {
  try {
    state = readState(localStorage)
    storageErrorKey = ''
  } catch {
    state ??= { active: null, history: [] }
    storageErrorKey = 'storageReadError'
  }
}

async function changeState(update) {
  const save = () => {
    const current = readState(localStorage)
    const next = update(current)
    if (next !== current)
      localStorage.setItem(storageKey, JSON.stringify(next))
    state = next
    storageErrorKey = ''
  }

  try {
    if (navigator.locks)
      await navigator.locks.request(storageKey, save)
    else
      save()
    return true
  } catch {
    storageErrorKey = 'storageWriteError'
    render()
    return false
  }
}

function view() {
  const hash = location.hash.slice(1)
  if (hash === 'quiz' && state.active)
    return ['quiz']
  if (hash === 'history')
    return ['history']
  if (hash.startsWith('report/')) {
    const report = state.history.find(item => item.id === hash.slice('report/'.length))
    return report ? ['report', report] : ['missing']
  }
  return ['home']
}

function summarizeReport(report) {
  const correctCount = report.questions.filter(item => report.answers[item.id] === item.correct).length
  const points = report.results.reduce((sum, item) => sum + item.points, 0)
  const max = report.results.reduce((sum, item) => sum + item.max, 0)
  const percent = max ? Math.round(points / max * 100) : 0
  return { correctCount, total: report.questions.length, points, max, percent }
}

function renderInspector(moduleId) {
  const mod = locModule(modules.find(item => item.id === moduleId) || modules[0])
  return `
    <div class="inspector-main">
      <strong>${escapeHtml(mod.name)}</strong>
      <p class="inspector-topics">${escapeHtml(mod.topics)}</p>
    </div>
    <span class="inspector-meta">${t().moduleCount(6)}</span>`
}

function kernelDiagram() {
  const dict = t()
  const is = id => (activeModuleId === id ? 'is-active' : '')
  const m = id => locModule(modules.find(item => item.id === id))
  const planner = m('planner')
  const executor = m('executor')
  const indexMod = m('index')
  const storage = m('storage')
  const tx = m('transaction')
  const wal = m('wal')

  return `
    <figure class="kernel-stage" aria-label="${escapeHtml(dict.diagramAria)}">
      <svg class="kernel-svg" viewBox="0 0 640 422" role="img" aria-label="${escapeHtml(dict.diagramAria)}">
        <defs>
          <marker id="pg-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 1 2 L 8 5 L 1 8 z" fill="var(--line-strong)"/>
          </marker>
        </defs>

        <!-- Layer 1: Query Processing -->
        <rect class="arch-layer-bg" x="14" y="12" width="612" height="118" rx="8"/>
        <text class="arch-layer-label" x="26" y="29">${escapeHtml(dict.layerQuery)}</text>

        <rect class="arch-sql-box" x="26" y="61" width="52" height="32" rx="5"/>
        <text class="arch-sql-text" x="52" y="81" text-anchor="middle">SQL</text>
        <path class="arch-flow" d="M 78 77 L 104 77" marker-end="url(#pg-arrow)"/>

        <g class="arch-node ${is('planner')}" data-module="planner" tabindex="0" role="button" aria-label="${escapeHtml(planner.name)}">
          <rect class="arch-node-depth" x="108" y="46" width="218" height="72" rx="7"/>
          <rect class="arch-node-face" x="108" y="42" width="218" height="72" rx="7"/>
          <circle class="arch-glyph-fill" cx="136" cy="60" r="6"/>
          <circle class="arch-glyph" cx="136" cy="60" r="5"/>
          <line class="arch-glyph" x1="133" y1="65" x2="124" y2="79"/>
          <line class="arch-glyph" x1="139" y1="65" x2="148" y2="79"/>
          <rect class="arch-glyph" x="118" y="80" width="12" height="9" rx="2"/>
          <rect class="arch-glyph" x="142" y="80" width="12" height="9" rx="2"/>
          <text class="arch-node-title" x="166" y="71">${escapeHtml(planner.shortName)}</text>
          <text class="arch-node-sub" x="166" y="89">Planner</text>
          <circle class="arch-pin-halo" cx="316" cy="52" r="10"/>
          <circle class="arch-pin-ring" cx="316" cy="52" r="5.5"/>
          <circle class="arch-pin-dot" cx="316" cy="52" r="2.2"/>
        </g>

        <path class="arch-flow" d="M 326 77 L 368 77" marker-end="url(#pg-arrow)"/>
        <text class="arch-flow-label" x="347" y="70" text-anchor="middle">Plan</text>

        <g class="arch-node ${is('executor')}" data-module="executor" tabindex="0" role="button" aria-label="${escapeHtml(executor.name)}">
          <rect class="arch-node-depth" x="372" y="46" width="240" height="72" rx="7"/>
          <rect class="arch-node-face" x="372" y="42" width="240" height="72" rx="7"/>
          <rect class="arch-glyph-box" x="386" y="54" width="32" height="10" rx="2"/>
          <rect class="arch-glyph-box" x="386" y="69" width="32" height="10" rx="2"/>
          <rect class="arch-glyph-box" x="386" y="84" width="32" height="10" rx="2"/>
          <path class="arch-glyph" d="M 424 90 L 424 58 M 421 62 L 424 58 L 427 62"/>
          <text class="arch-node-title" x="438" y="71">${escapeHtml(executor.shortName)}</text>
          <text class="arch-node-sub" x="438" y="89">Executor</text>
          <circle class="arch-pin-halo" cx="602" cy="52" r="10"/>
          <circle class="arch-pin-ring" cx="602" cy="52" r="5.5"/>
          <circle class="arch-pin-dot" cx="602" cy="52" r="2.2"/>
        </g>

        <!-- Connectors: Layer 1 -> Layer 2 -->
        <path class="arch-flow" d="M 452 118 L 452 138 L 116 138 L 116 170" marker-end="url(#pg-arrow)"/>
        <path class="arch-flow" d="M 452 138 L 320 138 L 320 170" marker-end="url(#pg-arrow)"/>
        <path class="arch-flow arch-flow-dashed" d="M 526 118 L 526 170" marker-end="url(#pg-arrow)"/>
        <text class="arch-flow-label" x="534" y="144">Snapshot</text>

        <!-- Layer 2: Shared Memory & Concurrency -->
        <rect class="arch-layer-bg" x="14" y="148" width="612" height="136" rx="8"/>
        <text class="arch-layer-label" x="26" y="165">${escapeHtml(dict.layerMemory)}</text>

        <g class="arch-node ${is('index')}" data-module="index" tabindex="0" role="button" aria-label="${escapeHtml(indexMod.name)}">
          <rect class="arch-node-depth" x="26" y="178" width="182" height="94" rx="7"/>
          <rect class="arch-node-face" x="26" y="174" width="182" height="94" rx="7"/>
          <text class="arch-node-title" x="40" y="199">${escapeHtml(indexMod.shortName)}</text>
          <text class="arch-node-sub" x="40" y="216">B-tree &amp; VM</text>
          <rect class="arch-glyph-box" x="40" y="229" width="44" height="14" rx="2"/>
          <rect class="arch-glyph-box" x="92" y="229" width="44" height="14" rx="2"/>
          <rect class="arch-glyph-box" x="144" y="229" width="46" height="14" rx="2"/>
          <text class="arch-glyph-text" x="62" y="239" text-anchor="middle">Key</text>
          <text class="arch-glyph-text" x="114" y="239" text-anchor="middle">TID</text>
          <text class="arch-glyph-text" x="167" y="239" text-anchor="middle">VM</text>
          <line class="arch-glyph" x1="84" y1="236" x2="92" y2="236"/>
          <line class="arch-glyph" x1="136" y1="236" x2="144" y2="236"/>
          <circle class="arch-pin-halo" cx="198" cy="184" r="10"/>
          <circle class="arch-pin-ring" cx="198" cy="184" r="5.5"/>
          <circle class="arch-pin-dot" cx="198" cy="184" r="2.2"/>
        </g>

        <g class="arch-node ${is('storage')}" data-module="storage" tabindex="0" role="button" aria-label="${escapeHtml(storage.name)}">
          <rect class="arch-node-depth" x="224" y="178" width="194" height="94" rx="7"/>
          <rect class="arch-node-face" x="224" y="174" width="194" height="94" rx="7"/>
          <text class="arch-node-title" x="238" y="199">${escapeHtml(lang === 'zh' ? '堆表与缓冲' : storage.shortName)}</text>
          <text class="arch-node-sub" x="238" y="216">Heap &amp; Buffers</text>
          <rect class="arch-glyph-box" x="238" y="229" width="164" height="24" rx="3"/>
          <rect class="arch-glyph-fill" x="239" y="230" width="44" height="22" rx="2"/>
          <rect class="arch-glyph-fill" x="348" y="230" width="53" height="22" rx="2"/>
          <text class="arch-glyph-text" x="261" y="244" text-anchor="middle">lower→</text>
          <text class="arch-glyph-text" x="315" y="244" text-anchor="middle">free</text>
          <text class="arch-glyph-text" x="374" y="244" text-anchor="middle">←upper</text>
          <circle class="arch-pin-halo" cx="408" cy="184" r="10"/>
          <circle class="arch-pin-ring" cx="408" cy="184" r="5.5"/>
          <circle class="arch-pin-dot" cx="408" cy="184" r="2.2"/>
        </g>

        <g class="arch-node ${is('transaction')}" data-module="transaction" tabindex="0" role="button" aria-label="${escapeHtml(tx.name)}">
          <rect class="arch-node-depth" x="434" y="178" width="178" height="94" rx="7"/>
          <rect class="arch-node-face" x="434" y="174" width="178" height="94" rx="7"/>
          <text class="arch-node-title" x="448" y="199">${escapeHtml(tx.shortName)}</text>
          <text class="arch-node-sub" x="448" y="216">MVCC &amp; Locks</text>
          <line class="arch-glyph" x1="448" y1="241" x2="594" y2="241"/>
          <circle class="arch-glyph-fill" cx="482" cy="241" r="4"/>
          <circle class="arch-glyph" cx="482" cy="241" r="4"/>
          <circle class="arch-glyph-fill" cx="556" cy="241" r="4"/>
          <circle class="arch-glyph" cx="556" cy="241" r="4"/>
          <text class="arch-glyph-text" x="482" y="258" text-anchor="middle">xmin</text>
          <text class="arch-glyph-text" x="519" y="234" text-anchor="middle">xip[]</text>
          <text class="arch-glyph-text" x="556" y="258" text-anchor="middle">xmax</text>
          <circle class="arch-pin-halo" cx="602" cy="184" r="10"/>
          <circle class="arch-pin-ring" cx="602" cy="184" r="5.5"/>
          <circle class="arch-pin-dot" cx="602" cy="184" r="2.2"/>
        </g>

        <!-- Connectors: Layer 2 -> Layer 3 -->
        <path class="arch-flow" d="M 320 272 L 320 322" marker-end="url(#pg-arrow)"/>
        <text class="arch-flow-label" x="328" y="299">WAL First</text>
        <path class="arch-flow arch-flow-dashed" d="M 523 272 L 523 322" marker-end="url(#pg-arrow)"/>
        <text class="arch-flow-label" x="531" y="299">Commit</text>

        <!-- Layer 3: Persistence & Recovery -->
        <rect class="arch-layer-bg" x="14" y="302" width="612" height="108" rx="8"/>
        <text class="arch-layer-label" x="26" y="319">${escapeHtml(dict.layerWal)}</text>

        <g class="arch-node ${is('wal')}" data-module="wal" tabindex="0" role="button" aria-label="${escapeHtml(wal.name)}">
          <rect class="arch-node-depth" x="26" y="330" width="586" height="68" rx="7"/>
          <rect class="arch-node-face" x="26" y="326" width="586" height="68" rx="7"/>
          <text class="arch-node-title" x="42" y="355">${escapeHtml(wal.shortName)}</text>
          <text class="arch-node-sub" x="42" y="374">Write-Ahead Log</text>
          <rect class="arch-glyph-box" x="234" y="344" width="76" height="30" rx="4"/>
          <text class="arch-glyph-text" x="272" y="362" text-anchor="middle">FPI</text>
          <path class="arch-flow" d="M 310 359 L 326 359" marker-end="url(#pg-arrow)"/>
          <rect class="arch-glyph-box" x="330" y="344" width="82" height="30" rx="4"/>
          <text class="arch-glyph-text" x="371" y="362" text-anchor="middle">WAL Flush</text>
          <path class="arch-flow" d="M 412 359 L 428 359" marker-end="url(#pg-arrow)"/>
          <rect class="arch-glyph-box" x="432" y="344" width="76" height="30" rx="4"/>
          <text class="arch-glyph-text" x="470" y="362" text-anchor="middle">CKPT</text>
          <path class="arch-flow" d="M 508 359 L 524 359" marker-end="url(#pg-arrow)"/>
          <rect class="arch-glyph-box" x="528" y="344" width="60" height="30" rx="4"/>
          <text class="arch-glyph-text" x="558" y="362" text-anchor="middle">REDO</text>
          <circle class="arch-pin-halo" cx="602" cy="336" r="10"/>
          <circle class="arch-pin-ring" cx="602" cy="336" r="5.5"/>
          <circle class="arch-pin-dot" cx="602" cy="336" r="2.2"/>
        </g>
      </svg>

      <div class="stage-inspector" id="stage-inspector" aria-live="polite">
        ${renderInspector(activeModuleId)}
      </div>

      <div class="stage-pills" role="group" aria-label="${escapeHtml(dict.diagramPillsAria)}">
        ${modules.map(raw => {
          const mod = locModule(raw)
          return `
          <button type="button" class="stage-pill" data-module="${mod.id}" aria-pressed="${activeModuleId === mod.id}">
            <i aria-hidden="true"></i>${escapeHtml(mod.shortName)}
          </button>`
        }).join('')}
      </div>
    </figure>`
}

function updateActiveModule(moduleId) {
  if (!modules.some(m => m.id === moduleId))
    return
  activeModuleId = moduleId
  main.querySelectorAll('.arch-node').forEach(node => {
    node.classList.toggle('is-active', node.dataset.module === moduleId)
  })
  main.querySelectorAll('.stage-pill').forEach(pill => {
    pill.setAttribute('aria-pressed', String(pill.dataset.module === moduleId))
  })
  const inspector = main.querySelector('#stage-inspector')
  if (inspector)
    inspector.innerHTML = renderInspector(moduleId)
}

function home() {
  const dict = t()
  const answeredCount = state.active ? Object.keys(state.active.answers).length : 0
  const resume = state.active
    ? `<span class="resume-note">${escapeHtml(dict.resumeCount(answeredCount, questions.length))}</span>`
    : ''

  return `
    <section class="home-page" aria-labelledby="home-title">
      <div class="hero-band">
        <div class="hero-copy">
          <h1 id="home-title" lang="en">How Well Do You Know<br><span>PostgreSQL?</span></h1>
          <p class="hero-lead">${escapeHtml(dict.heroLead(PG_VERSION))}</p>
          <div class="hero-actions">
            <button class="button button-primary" data-action="start">${escapeHtml(state.active ? dict.resumeQuiz : dict.startQuiz)} →</button>
            ${state.history.length ? `<a class="button button-secondary" href="#history">${escapeHtml(dict.navHistory)}</a>` : ''}
            ${resume}
          </div>
          <p class="hero-meta">${escapeHtml(dict.heroMeta(modules.length, questions.length))}</p>
        </div>
        ${kernelDiagram()}
      </div>
    </section>`
}

function quiz() {
  const dict = t()
  const { position, answers } = state.active
  const item = locQuestion(questions[position])
  const module = locModule(modules.find(candidate => candidate.id === item.module))
  const level = locLevel(levels.find(candidate => candidate.id === item.level))
  const count = Object.keys(answers).length
  return `
    <section class="quiz-page" aria-labelledby="quiz-title">
      <div class="page-top">
        <a class="text-link" href="#home">${escapeHtml(dict.backHome)}</a>
        <span class="progress-count" aria-live="polite">${escapeHtml(dict.answeredProgress(count, questions.length))}</span>
      </div>
      <div class="quiz-progress">
        <progress aria-label="${escapeHtml(dict.progressAria)}" value="${count}" max="${questions.length}"></progress>
      </div>
      <div class="quiz-layout">
        <article class="question-panel">
          <div class="question-meta">
            <strong>${escapeHtml(dict.questionOf(position + 1, questions.length))}</strong>
            <span>${escapeHtml(module.name)}</span>
            <span class="tier-tag tier-${level.id}">${escapeHtml(level.name)} · ${escapeHtml(dict.pointsUnit(level.points))}</span>
          </div>
          <h1 id="quiz-title" data-focus tabindex="-1">${escapeHtml(item.prompt)}</h1>
          ${item.code ? `<pre><code>${escapeHtml(item.code)}</code></pre>` : ''}
          <fieldset class="options" aria-labelledby="quiz-title">
            ${item.options.map((option, index) => `
              <label class="option">
                <input type="radio" name="answer" value="${index}" ${answers[item.id] === index ? 'checked' : ''}>
                <span class="option-letter" aria-hidden="true">${letters[index]}</span>
                <span>${escapeHtml(option)}</span>
              </label>`).join('')}
          </fieldset>
          <div class="quiz-actions">
            <button class="button button-secondary" data-position="${position - 1}" ${position === 0 ? 'disabled' : ''}>${escapeHtml(dict.prevQuestion)}</button>
            ${position < questions.length - 1
              ? `<button class="button button-primary" data-position="${position + 1}">${escapeHtml(dict.nextQuestion)}</button>`
              : `<button class="button button-primary" data-action="confirm">${escapeHtml(dict.submitPaper)}</button>`}
          </div>
        </article>
        <aside class="question-map" aria-label="${escapeHtml(dict.answerSheetAria)}">
          <h2>${escapeHtml(dict.answerSheet)}</h2>
          ${levels.map(rawGroup => {
            const group = locLevel(rawGroup)
            return `<div class="map-group"><p>${escapeHtml(group.name)} (${escapeHtml(dict.pointsUnit(group.points))})</p><div class="number-grid">
            ${questions.map((question, index) => question.level === group.id ? `<button
              type="button" data-position="${index}"
              aria-label="${escapeHtml(dict.mapItemAria(index + 1, Object.hasOwn(answers, question.id)))}"
              ${index === position ? 'aria-current="step"' : ''}
              class="${Object.hasOwn(answers, question.id) ? 'answered' : ''}">${index + 1}</button>` : '').join('')}
          </div></div>`
          }).join('')}
          <div class="map-footer"><button class="button button-secondary" data-action="confirm">${escapeHtml(dict.submitPaper)}</button></div>
        </aside>
      </div>
    </section>`
}

function history() {
  const dict = t()
  const ordered = [...state.history].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  return `
    <section class="inner-page" aria-labelledby="history-title">
      <div class="page-top"><a class="text-link" href="#home">${escapeHtml(dict.backHome)}</a></div>
      <h1 id="history-title" data-focus tabindex="-1">${escapeHtml(dict.historyTitle)}</h1>
      ${ordered.length ? `<ul class="history-list">${ordered.map(item => {
        const summary = summarizeReport(item)
        return `<li><a href="#report/${escapeHtml(item.id)}">
          <div class="history-meta">
            <strong>${dateFormats[lang].format(new Date(item.submittedAt))}</strong>
          </div>
          <div class="history-score">
            <b>${summary.percent}%</b>
            <span>${escapeHtml(dict.historyDetail(summary.points, summary.max, summary.correctCount, summary.total))}</span>
            <span class="history-link">${escapeHtml(dict.viewReport)}</span>
          </div>
        </a></li>`
      }).join('')}</ul>` : `<div class="empty"><p>${escapeHtml(dict.historyEmpty)}</p><a class="button button-primary" href="#home">${escapeHtml(dict.startQuiz)}</a></div>`}
    </section>`
}

function reviewItem(rawItem, index, answers, moduleName) {
  const dict = t()
  const item = locQuestion(rawItem)
  const response = answers[item.id]
  const isCorrect = response === item.correct
  const isUnanswered = response === undefined
  const statusText = isCorrect ? dict.statusCorrect : isUnanswered ? dict.statusUnanswered : dict.statusWrong
  const statusClass = isCorrect ? 'correct' : isUnanswered ? 'unanswered' : 'wrong'
  return `
    <details class="review-item" ${allExpanded ? 'open' : ''}>
      <summary>
        <span class="review-number">${String(index + 1).padStart(2, '0')}</span>
        <span class="review-module-tag">${escapeHtml(moduleName)}</span>
        <span class="review-topic">${escapeHtml(item.topic)}</span>
        <span class="review-status ${statusClass}">${escapeHtml(statusText)}</span>
      </summary>
      <div class="review-body">
        <h3>${escapeHtml(item.prompt)}</h3>
        ${item.code ? `<pre><code>${escapeHtml(item.code)}</code></pre>` : ''}
        <ol class="review-options" type="A">${item.options.map((option, optionIndex) => {
          const optCorrect = optionIndex === item.correct
          const optSelected = optionIndex === response
          const cls = optCorrect ? 'correct-option' : optSelected ? 'wrong-option' : ''
          return `<li class="${cls}">${escapeHtml(option)}${optCorrect ? `<span class="tag tag-correct">${escapeHtml(dict.tagCorrect)}</span>` : ''}${optSelected ? `<span class="tag tag-choice">${escapeHtml(dict.tagChoice)}</span>` : ''}</li>`
        }).join('')}</ol>
        <p class="review-explanation">${escapeHtml(item.explanation)}</p>
        <a class="text-link" href="${escapeHtml(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source.label)} ↗</a>
      </div>
    </details>`
}

function reviewItems(report) {
  const dict = t()
  const moduleNames = Object.fromEntries(report.results.map(m => [m.id, locModule(m).shortName]))
  const items = report.questions.map((item, index) => {
    if (reviewFilter !== 'all' && reviewFilter !== item.module)
      return ''
    if (statusFilter === 'missed' && report.answers[item.id] === item.correct)
      return ''
    return reviewItem(item, index, report.answers, moduleNames[item.module] || item.module)
  }).filter(Boolean)
  return items.length
    ? items.join('')
    : `<div class="review-empty">${escapeHtml(dict.reviewEmpty)}</div>`
}

function results(report) {
  const dict = t()
  const summary = summarizeReport(report)
  return `
    <section class="inner-page" aria-labelledby="report-title">
      <div class="page-top">
        <a class="text-link" href="#history">${escapeHtml(dict.backHistory)}</a>
      </div>
      <h1 id="report-title" data-focus tabindex="-1">${escapeHtml(dict.reportTitle)}</h1>
      <p class="page-intro">${dateFormats[lang].format(new Date(report.submittedAt))}</p>
      <dl class="summary-strip">
        <div><dt>${escapeHtml(dict.summaryPercent)}</dt><dd><strong>${summary.percent}%</strong></dd></div>
        <div><dt>${escapeHtml(dict.summaryPoints)}</dt><dd><strong>${summary.points}</strong><span>/ ${summary.max}</span></dd></div>
        <div><dt>${escapeHtml(dict.summaryCorrect)}</dt><dd><strong>${summary.correctCount}</strong><span>/ ${summary.total}</span></dd></div>
      </dl>
      <section class="results-section" aria-labelledby="modules-title">
        <div class="section-head">
          <h2 id="modules-title">${escapeHtml(dict.moduleScoresTitle)}</h2>
        </div>
        <div class="score-table-wrap">
          <table class="score-table">
            <thead>
              <tr>
                <th>${escapeHtml(dict.colModule)}</th>
                <th class="bar-cell" aria-label="${escapeHtml(dict.colBarAria)}"></th>
                <th class="num">${escapeHtml(dict.colPercent)}</th>
                <th class="num">${escapeHtml(dict.colPoints)}</th>
                ${levels.map(level => `<th class="num">${escapeHtml(locLevel(level).short)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${report.results.map(rawModule => {
                const module = locModule(rawModule)
                const tone = module.percent >= 80 ? 'high' : module.percent < 50 ? 'low' : ''
                return `<tr>
                  <td class="score-module">${escapeHtml(module.name)}</td>
                  <td class="bar-cell"><div class="bar-track" aria-hidden="true"><div class="bar-fill ${tone}" style="width:${module.percent}%"></div></div></td>
                  <td class="num"><strong>${module.percent}%</strong></td>
                  <td class="num">${module.points} / ${module.max}</td>
                  ${module.breakdown.map(level => `<td class="num">${level.correct}/${level.total}</td>`).join('')}
                </tr>`
              }).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <section class="review-section" aria-labelledby="review-title">
        <div class="section-head">
          <h2 id="review-title">${escapeHtml(dict.reviewTitle)}</h2>
          <div class="review-controls">
            <select id="status-filter" aria-label="${escapeHtml(dict.filterStatusAria)}">
              <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>${escapeHtml(dict.filterAll)}</option>
              <option value="missed" ${statusFilter === 'missed' ? 'selected' : ''}>${escapeHtml(dict.filterMissed)}</option>
            </select>
            <select id="review-filter" aria-label="${escapeHtml(dict.filterModuleAria)}">
              <option value="all">${escapeHtml(dict.filterAllModules)}</option>
              ${report.results.map(rawModule => {
                const module = locModule(rawModule)
                return `<option value="${module.id}" ${reviewFilter === module.id ? 'selected' : ''}>${escapeHtml(module.name)}</option>`
              }).join('')}
            </select>
            <button type="button" class="button button-ghost" data-action="toggle-all">${escapeHtml(allExpanded ? dict.collapseAll : dict.expandAll)}</button>
          </div>
        </div>
        <div id="review-items" class="review-list">${reviewItems(report)}</div>
      </section>
    </section>`
}

function render(focus = false) {
  const dict = t()
  const [route, report] = view()
  document.querySelectorAll('[data-nav]').forEach(link => {
    const selected = link.dataset.nav === (route === 'report' || route === 'history' ? 'history' : 'home')
    if (selected)
      link.setAttribute('aria-current', 'page')
    else
      link.removeAttribute('aria-current')
    if (link.dataset.nav === 'home')
      link.textContent = dict.navHome
    if (link.dataset.nav === 'history') {
      const count = state.history.length
      link.innerHTML = count ? `${escapeHtml(dict.navHistory)} <span class="nav-count">${count}</span>` : escapeHtml(dict.navHistory)
    }
  })
  const contents = {
    home,
    quiz,
    history,
    report: () => results(report),
    missing: () => `<section class="inner-page"><h1 data-focus tabindex="-1">${escapeHtml(dict.missingTitle)}</h1><p style="margin-top:16px"><a class="button button-primary" href="#history">${escapeHtml(dict.returnHistory)}</a></p></section>`,
  }
  const errorText = storageErrorKey ? dict[storageErrorKey] : ''
  main.innerHTML = `${errorText ? `<p class="storage-error" role="alert">${escapeHtml(errorText)}</p>` : ''}${contents[route]()}`
  if (focus)
    (main.querySelector('[data-focus]') || main).focus({ preventScroll: true })
}

async function move(position) {
  const id = state.active.id
  if (position < 0 || position >= questions.length)
    return
  if (await changeState(current => current.active?.id === id
    ? { ...current, active: { ...current.active, position } }
    : current)) {
    render(true)
    window.scrollTo({ top: 0 })
  }
}

async function selectAnswer(choice) {
  const [route] = view()
  if (route !== 'quiz' || !state.active)
    return
  const { id, position } = state.active
  const qid = questions[position].id
  if (await changeState(current => current.active?.id === id
    ? { ...current, active: { ...current.active, answers: { ...current.active.answers, [qid]: choice } } }
    : current)) {
    const updated = view()[0] === 'quiz' && state.active.position === position
    const input = main.querySelector(`input[name="answer"][value="${choice}"]`)
    if (updated && input && !main.querySelector('.storage-error')) {
      const dict = t()
      input.checked = true
      const count = Object.keys(state.active.answers).length
      main.querySelector('progress').value = count
      main.querySelector('.progress-count').textContent = dict.answeredProgress(count, questions.length)
      const number = main.querySelector(`.number-grid [data-position="${position}"]`)
      number.classList.add('answered')
      number.setAttribute('aria-label', dict.mapItemAria(position + 1, true))
    } else {
      render()
    }
  }
}

main.addEventListener('click', async event => {
  const moduleTarget = event.target.closest('[data-module]')
  if (moduleTarget) {
    updateActiveModule(moduleTarget.dataset.module)
    return
  }

  const button = event.target.closest('button')
  if (!button)
    return

  if (button.hasAttribute('data-position') && state.active) {
    await move(Number(button.dataset.position))
    return
  }

  if (button.dataset.action === 'start') {
    if (await changeState(current => current.active ? current : { ...current, active: createAttempt() })) {
      if (location.hash === '#quiz')
        onRoute()
      else
        location.hash = 'quiz'
    }
    return
  }

  if (button.dataset.action === 'confirm' && state.active) {
    const dict = t()
    const missing = questions.length - Object.keys(state.active.answers).length
    submissionId = state.active.id
    confirmation.returnValue = 'cancel'
    document.querySelector('#confirm-copy').textContent = missing
      ? dict.confirmMissing(missing)
      : dict.confirmAllDone(questions.length)
    confirmation.showModal()
    return
  }

  if (button.dataset.action === 'toggle-all') {
    const dict = t()
    allExpanded = !allExpanded
    main.querySelectorAll('.review-item').forEach(el => {
      el.open = allExpanded
    })
    button.textContent = allExpanded ? dict.collapseAll : dict.expandAll
  }
})

main.addEventListener('mouseover', event => {
  const node = event.target.closest('.arch-node[data-module]')
  if (node && node.dataset.module !== activeModuleId)
    updateActiveModule(node.dataset.module)
})

main.addEventListener('keydown', event => {
  const node = event.target.closest('.arch-node[data-module]')
  if (node && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
    updateActiveModule(node.dataset.module)
  }
})

main.addEventListener('change', async event => {
  const input = event.target
  const [route, report] = view()
  if ((input.id === 'review-filter' || input.id === 'status-filter') && route === 'report') {
    if (input.id === 'review-filter')
      reviewFilter = input.value
    if (input.id === 'status-filter')
      statusFilter = input.value
    document.querySelector('#review-items').innerHTML = reviewItems(report)
    return
  }

  if (input.name === 'answer' && route === 'quiz')
    await selectAnswer(Number(input.value))
})

document.addEventListener('keydown', async event => {
  if (confirmation.open || event.metaKey || event.ctrlKey || event.altKey)
    return
  const [route] = view()
  if (route !== 'quiz' || !state.active)
    return
  const tag = event.target?.tagName
  if (tag === 'SELECT' || tag === 'TEXTAREA')
    return

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    await move(state.active.position - 1)
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    await move(state.active.position + 1)
  } else if (event.key >= '1' && event.key <= '4') {
    event.preventDefault()
    await selectAnswer(Number(event.key) - 1)
  }
})

confirmation.addEventListener('close', async () => {
  const id = submissionId
  submissionId = undefined
  if (confirmation.returnValue === 'submit' && id) {
    if (await changeState(current => finishAttempt(current, id)) && state.history.some(report => report.id === id))
      location.hash = `report/${id}`
  }
})

function onRoute() {
  if (location.hash === '#main')
    return
  if (location.hash !== previousRoute) {
    reviewFilter = 'all'
    statusFilter = 'all'
    allExpanded = false
  }
  previousRoute = location.hash
  render(true)
  window.scrollTo({ top: 0 })
}

window.addEventListener('hashchange', onRoute)
window.addEventListener('storage', event => {
  if (event.key === storageKey || event.key === null) {
    refreshState()
    render()
  }
})
document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault()
  main.focus()
})

syncChrome()
refreshState()
render()
