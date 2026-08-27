import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deepMerge } from './persist.ts'

describe('deepMerge', () => {
  it('keeps defaults for missing keys', () => {
    const target = { a: 1, nested: { x: 1, y: 2 } }
    const out = deepMerge(target, { nested: { x: 9 } })
    assert.deepEqual(out, { a: 1, nested: { x: 9, y: 2 } })
  })

  it('overwrites scalars and arrays', () => {
    const out = deepMerge({ n: 1, list: [1] }, { n: 2, list: [3, 4] })
    assert.deepEqual(out, { n: 2, list: [3, 4] })
  })
})
