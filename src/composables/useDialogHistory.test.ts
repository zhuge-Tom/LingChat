import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseHistorySegments } from '../utils/historySegments.ts'

describe('parseHistorySegments', () => {
  it('splits dialogue and inline actions', () => {
    const segs = parseHistorySegments('你好。（挥手）再见。', undefined, false)
    assert.equal(segs.some((s) => s.type === 'dialogue' && s.text.includes('你好')), true)
    assert.equal(segs.some((s) => s.type === 'dialogue' && s.text.includes('再见')), true)
  })

  it('appends explicit action part', () => {
    const segs = parseHistorySegments('走吧', '（点头）', false)
    assert.deepEqual(segs[segs.length - 1], { type: 'action', text: '（点头）' })
  })
})
