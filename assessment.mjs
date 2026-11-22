import { questions, modules, levels, PAPER_VERSION } from './questions.mjs'

export const storageKey = 'knowpg.v1'

export function createAttempt() {
  return {
    id: crypto.randomUUID(),
    paper: PAPER_VERSION,
    startedAt: new Date().toISOString(),
    position: 0,
    answers: {},
  }
}

export function score(items, answers) {
  return modules.map(module => {
    const breakdown = levels.map(level => {
      const group = items.filter(item => item.module === module.id && item.level === level.id)
      const correct = group.filter(item => answers[item.id] === item.correct).length
      return { ...level, correct, total: group.length }
    })
    const points = breakdown.reduce((sum, level) => sum + level.correct * level.points, 0)
    const max = breakdown.reduce((sum, level) => sum + level.total * level.points, 0)
    return { ...module, points, max, percent: Math.round(points / max * 100), breakdown }
  })
}

export function finishAttempt(state, id, submittedAt = new Date().toISOString()) {
  if (state.active?.id !== id || state.history.some(report => report.id === id))
    return state

  const { position, ...attempt } = state.active
  const report = {
    ...attempt,
    submittedAt,
    results: score(questions, attempt.answers),
    questions,
  }
  return { active: null, history: [report, ...state.history] }
}

export function readState(storage) {
  const raw = storage.getItem(storageKey)
  if (raw === null)
    return { active: null, history: [] }
  const state = JSON.parse(raw)
  if (!state || !Array.isArray(state.history) || !Object.hasOwn(state, 'active'))
    throw new Error('保存的记录格式有误')
  return state
}
