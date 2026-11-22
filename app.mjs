import { PG_VERSION, PAPER_VERSION, modules, levels, questions } from './questions.mjs'
import { createAttempt, finishAttempt, readState, storageKey } from './assessment.mjs'
import { drawElephant } from './hero.mjs'

const main = document.querySelector('main')
const confirmation = document.querySelector('#confirmation')
const dateFormat = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })
const letters = ['A', 'B', 'C', 'D']
let state
let storageError = ''
let reviewFilter = 'all'
let submissionId
let previousRoute

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function refreshState() {
  try {
    state = readState(localStorage)
    storageError = ''
  } catch {
    state ??= { active: null, history: [] }
    storageError = '无法读取浏览器中的作答记录。请确认浏览器允许本站访问本地存储。'
  }
}

async function changeState(update) {
  const save = () => {
    const current = readState(localStorage)
    const next = update(current)
    if (next !== current)
      localStorage.setItem(storageKey, JSON.stringify(next))
    state = next
    storageError = ''
  }

  try {
    if (navigator.locks)
      await navigator.locks.request(storageKey, save)
    else
      save()
    return true
  } catch {
    storageError = '保存失败，已保留上次保存的进度。请检查浏览器的本地存储空间或权限后重试。'
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

function icon(module) {
  return `<span class="module-icon icon-${module.icon}" aria-hidden="true"><i></i><i></i><i></i></span>`
}

function home() {
  const resume = state.active
    ? `<span class="resume-count">已答 ${Object.keys(state.active.answers).length} / ${questions.length} 题</span>`
    : ''
  return `
    <section class="hero" aria-labelledby="home-title">
      <div class="hero-content">
        <span class="version"><span></span> PostgreSQL ${PG_VERSION} 题卷</span>
        <h1 id="home-title"><span lang="en">PostgreSQL</span><br>内核熟悉度自测</h1>
        <p class="hero-summary">从理解核心概念，到推演运行机制，再到读懂源码。<br class="desktop-break">完成一套自测，看看你对各个模块掌握到了哪一层。</p>
        <div class="hero-actions"><button class="button button-primary" data-action="start">${state.active ? '继续作答' : '开始自测'} <span aria-hidden="true">→</span></button>${resume}</div>
      </div>
      <div class="hero-visual">
        <canvas id="hero-elephant" width="32" height="24" aria-hidden="true"></canvas>
        <figure class="terminal">
          <figcaption class="terminal-bar">
            <span class="terminal-controls" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>psql <span class="terminal-divider">/</span> EXPLAIN 示例</span>
          </figcaption>
          <pre><code><span class="terminal-prompt">postgres=#</span> <b>EXPLAIN</b> (COSTS OFF)
<span class="terminal-prompt">postgres-#</span> <b>SELECT</b> relname <b>FROM</b> <span class="terminal-identifier">pg_class</span>
<span class="terminal-prompt">postgres-#</span> <b>WHERE</b> oid = <span class="terminal-literal">1259</span>;

<span class="terminal-plan">QUERY PLAN</span>
<span class="terminal-node">Index Scan</span> using pg_class_oid_index on pg_class
  Index Cond: (oid = '1259'::oid)</code></pre>
        </figure>
      </div>
    </section>
    <dl class="facts">
      <div><dt>覆盖模块</dt><dd><strong>6</strong><span>个</span></dd></div>
      <div><dt>固定题卷</dt><dd><strong>36</strong><span>道单选题</span></dd></div>
      <div><dt>预计耗时</dt><dd><strong>45–60</strong><span>分钟</span></dd></div>
    </dl>
    <section class="coverage" aria-labelledby="coverage-title">
      <div class="section-heading">
        <h2 id="coverage-title">测评覆盖模块</h2>
        <p>每个模块 6 题，覆盖概念、机制和源码。</p>
      </div>
      <ul class="module-grid">
        ${modules.map(module => `<li class="module-tile">${icon(module)}<div><h3>${module.name}</h3><p>${module.topics}</p></div></li>`).join('')}
      </ul>
    </section>`
}

function quiz() {
  const { position, answers } = state.active
  const item = questions[position]
  const module = modules.find(candidate => candidate.id === item.module)
  const level = levels.find(candidate => candidate.id === item.level)
  const count = Object.keys(answers).length
  return `
    <section class="quiz-page" aria-labelledby="quiz-title">
      <div class="page-top"><a class="text-link" href="#home">← 返回首页</a><span class="paper-label">${PAPER_VERSION}</span></div>
      <div class="quiz-progress">
        <div><strong>作答进度</strong><span aria-live="polite">已答 ${count} / ${questions.length} 题</span></div>
        <progress aria-label="已答题数" value="${count}" max="${questions.length}"></progress>
      </div>
      <div class="quiz-layout">
        <article class="question-panel">
          <div class="question-meta"><strong>第 ${position + 1} 题</strong><span>${module.name}</span><span>${level.name} · ${level.points} 分</span></div>
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
            <button class="button button-secondary" data-position="${position - 1}" ${position === 0 ? 'disabled' : ''}>← 上一题</button>
            ${position < questions.length - 1
              ? `<button class="button button-primary" data-position="${position + 1}">下一题 →</button>`
              : '<button class="button button-primary" data-action="confirm">提交试卷 →</button>'}
          </div>
        </article>
        <aside class="question-map" aria-label="题号导航">
          <h2>答题卡</h2>
          ${levels.map(group => `<div class="map-group"><p>${group.name}</p><div class="number-grid">
            ${questions.map((question, index) => question.level === group.id ? `<button
              type="button" data-position="${index}"
              aria-label="第 ${index + 1} 题，${Object.hasOwn(answers, question.id) ? '已答' : '未答'}"
              ${index === position ? 'aria-current="step"' : ''}
              class="${Object.hasOwn(answers, question.id) ? 'answered' : ''}">${index + 1}</button>` : '').join('')}
          </div></div>`).join('')}
          <div class="map-footer"><button class="button button-secondary" data-action="confirm">提交试卷</button></div>
        </aside>
      </div>
    </section>`
}

function history() {
  const ordered = [...state.history].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  return `
    <section class="inner-page" aria-labelledby="history-title">
      <div class="page-top"><a class="text-link" href="#home">← 返回首页</a></div>
      <h1 id="history-title" data-focus tabindex="-1">历史报告</h1>
      <p class="page-intro">查看当前浏览器保存的自测结果。</p>
      ${ordered.length ? `<ul class="history-list">${ordered.map(item => `<li><a href="#report/${escapeHtml(item.id)}"><div><strong>${dateFormat.format(new Date(item.submittedAt))}</strong><small>${escapeHtml(item.paper)}</small></div><span>查看报告 →</span></a></li>`).join('')}</ul>` : '<div class="empty"><h2>还没有历史报告</h2><p>交卷后，这里会保留你的模块得分和逐题解析。</p><a class="button button-primary" href="#home">返回自测首页 →</a></div>'}
    </section>`
}

function reviewItem(item, index, answers) {
  const response = answers[item.id]
  const status = response === item.correct ? '正确' : response === undefined ? '未答' : '答错'
  return `
    <details class="review-item">
      <summary><span class="review-number">${String(index + 1).padStart(2, '0')}</span><span class="review-topic">${escapeHtml(item.topic)}</span><span class="review-status ${response === item.correct ? 'correct' : ''}">${status}</span></summary>
      <div class="review-body">
        <h3>${escapeHtml(item.prompt)}</h3>
        ${item.code ? `<pre><code>${escapeHtml(item.code)}</code></pre>` : ''}
        <ol class="review-options" type="A">${item.options.map((option, optionIndex) => `
          <li class="${optionIndex === item.correct ? 'correct-option' : ''}">${escapeHtml(option)}
            ${optionIndex === item.correct ? '<span>正确答案</span>' : ''}
            ${optionIndex === response ? '<span>你的选择</span>' : ''}</li>`).join('')}</ol>
        <p>${escapeHtml(item.explanation)}</p>
        <a class="text-link" href="${escapeHtml(item.source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source.label)} ↗</a>
      </div>
    </details>`
}

function reviewItems(report) {
  return report.questions.map((item, index) =>
    reviewFilter === 'all' || reviewFilter === item.module ? reviewItem(item, index, report.answers) : ''
  ).join('')
}

function results(report) {
  return `
    <section class="inner-page" aria-labelledby="report-title">
      <div class="page-top"><a class="text-link" href="#history">← 历史报告</a><span class="paper-label">${escapeHtml(report.paper)}</span></div>
      <h1 id="report-title" data-focus tabindex="-1">自测报告</h1>
      <p class="page-intro">${dateFormat.format(new Date(report.submittedAt))} 提交 · 答对 ${report.questions.filter(item => report.answers[item.id] === item.correct).length} / ${report.questions.length} 题</p>
      <section class="results-section" aria-labelledby="modules-title">
        <div class="section-heading"><h2 id="modules-title">模块熟悉度</h2><p>概念、机制、源码题分别计 1、2、3 分，折算为百分制。</p></div>
        <div class="results-grid">${report.results.map(module => `
          <article class="result-card">
            <div class="result-title">${icon(module)}<h3>${escapeHtml(module.name)}</h3></div>
            <p class="result-value"><strong>${module.percent}</strong><span> / 100</span><small>${module.points} / ${module.max} 原始分</small></p>
            <meter aria-label="${escapeHtml(module.name)}熟悉度" min="0" max="100" value="${module.percent}"></meter>
            <dl>${module.breakdown.map(level => `<div><dt>${escapeHtml(level.name)}</dt><dd>${level.correct} / ${level.total}</dd></div>`).join('')}</dl>
          </article>`).join('')}
        </div>
      </section>
      <section class="review-section" aria-labelledby="review-title">
        <div class="section-heading review-heading"><h2 id="review-title">逐题回顾</h2><div><label for="review-filter">模块</label> <select id="review-filter">
          <option value="all">全部模块</option>
          ${report.results.map(module => `<option value="${module.id}" ${reviewFilter === module.id ? 'selected' : ''}>${escapeHtml(module.name)}</option>`).join('')}
        </select></div></div>
        <div id="review-items">${reviewItems(report)}</div>
      </section>
    </section>`
}

function render(focus = false) {
  const [route, report] = view()
  document.querySelectorAll('[data-nav]').forEach(link => {
    const selected = link.dataset.nav === (route === 'report' || route === 'history' ? 'history' : 'home')
    if (selected)
      link.setAttribute('aria-current', 'page')
    else
      link.removeAttribute('aria-current')
  })
  const contents = {
    home,
    quiz,
    history,
    report: () => results(report),
    missing: () => '<section class="inner-page"><h1 data-focus tabindex="-1">找不到这份报告</h1><p class="page-intro">历史报告存放在作答时使用的浏览器中。</p><a class="button button-primary" href="#history">查看历史报告 →</a></section>',
  }
  main.innerHTML = `${storageError ? `<p class="storage-error" role="alert">${escapeHtml(storageError)}</p>` : ''}${contents[route]()}`
  const canvas = document.querySelector('#hero-elephant')
  if (canvas)
    drawElephant(canvas)
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

main.addEventListener('click', async event => {
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
  }

  if (button.dataset.action === 'confirm' && state.active) {
    const missing = questions.length - Object.keys(state.active.answers).length
    submissionId = state.active.id
    confirmation.returnValue = 'cancel'
    document.querySelector('#confirm-copy').textContent = missing
      ? `还有 ${missing} 题未答，未答题计 0 分。交卷后即可查看结果和解析。`
      : '你已答完全部题目。交卷后即可查看结果和解析。'
    confirmation.showModal()
  }
})

main.addEventListener('change', async event => {
  const input = event.target
  const [route, report] = view()
  if (input.id === 'review-filter' && route === 'report') {
    reviewFilter = input.value
    document.querySelector('#review-items').innerHTML = reviewItems(report)
  }

  if (input.name === 'answer' && route === 'quiz') {
    const { id, position } = state.active
    const qid = questions[position].id
    const choice = Number(input.value)
    if (await changeState(current => current.active?.id === id
      ? { ...current, active: { ...current.active, answers: { ...current.active.answers, [qid]: choice } } }
      : current)) {
      const updated = view()[0] === 'quiz' && state.active.position === position
      if (updated && input.isConnected && !main.querySelector('.storage-error')) {
        const count = Object.keys(state.active.answers).length
        main.querySelector('progress').value = count
        main.querySelector('.quiz-progress span').textContent = `已答 ${count} / ${questions.length} 题`
        const number = main.querySelector(`.number-grid [data-position="${position}"]`)
        number.classList.add('answered')
        number.setAttribute('aria-label', `第 ${position + 1} 题，已答`)
      } else {
        render()
      }
    }
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
  if (location.hash !== previousRoute)
    reviewFilter = 'all'
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

refreshState()
render()
