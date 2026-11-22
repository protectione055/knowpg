import { test } from 'node:test'
import assert from 'node:assert/strict'
import { modules, levels, questions, PAPER_VERSION } from './questions.mjs'
import { createAttempt, finishAttempt, readState, score, storageKey } from './assessment.mjs'

test('固定试卷每层按模块排列，每模块每层两道四选一题', () => {
  assert.equal(questions.length, 36)
  assert.equal(new Set(questions.map(item => item.id)).size, 36)
  assert.deepEqual(questions.map(item => [item.level, item.module]),
    levels.flatMap(level => modules.flatMap(module => [[level.id, module.id], [level.id, module.id]])))
  for (const item of questions) {
    assert.equal(new Set(item.options).size, 4, item.id)
    assert.ok(Number.isInteger(item.correct) && item.correct >= 0 && item.correct < 4, item.id)
    assert.ok(item.prompt && item.explanation && item.source.url, item.id)
    if (item.level === 'source') {
      assert.ok(item.code, item.id)
      assert.match(item.source.url, /724edf9bde9d356724ad384a2e196edc3c9f80f7\/.+#L\d+$/)
    }
  }
})

test('全对、全错、未答与不同题型按 1/2/3 加权', () => {
  const correct = Object.fromEntries(questions.map(item => [item.id, item.correct]))
  const incorrect = Object.fromEntries(questions.map(item => [item.id, (item.correct + 1) % 4]))
  assert.deepEqual(score(questions, correct).map(item => item.percent), Array(6).fill(100))
  assert.deepEqual(score(questions, incorrect).map(item => item.percent), Array(6).fill(0))
  assert.deepEqual(score(questions, {}).map(item => item.percent), Array(6).fill(0))

  const result = score(questions, Object.fromEntries(['P1', 'P2', 'P3', 'P5'].map(id => [id, correct[id]])))[0]
  assert.equal(result.points, 7)
  assert.equal(result.max, 12)
  assert.equal(result.percent, 58)
  assert.deepEqual(result.breakdown.map(item => [item.correct, item.total]), [[2, 2], [1, 2], [1, 2]])
})

test('交卷保留题卷和答案快照，重复提交只产生一份报告', () => {
  const first = createAttempt()
  first.answers.P1 = 1
  const submitted = finishAttempt({ active: first, history: [] }, first.id, '2026-11-22T01:05:00Z')
  assert.equal(submitted.active, null)
  assert.equal(submitted.history[0].paper, PAPER_VERSION)
  assert.equal(submitted.history[0].questions.length, 36)
  assert.strictEqual(finishAttempt(submitted, first.id), submitted)

  const second = createAttempt()
  const repeated = finishAttempt({ ...submitted, active: second }, second.id, '2026-11-22T01:10:00Z')
  assert.deepEqual(repeated.history.map(report => report.id), [second.id, first.id])
  assert.equal(repeated.history[0].results[0].points, 0)
  assert.equal(repeated.history[1].results[0].points, 1)
  const stored = new Map([[storageKey, JSON.stringify(repeated)]])
  assert.deepEqual(readState({ getItem: key => stored.get(key) ?? null }), repeated)
})
