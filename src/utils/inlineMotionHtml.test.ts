import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildInlineMotionHtml } from './inlineMotionHtml.ts'

describe('buildInlineMotionHtml', () => {
  it('wraps narration', () => {
    const html = buildInlineMotionHtml('旁白', true)
    assert.match(html, /narration-inline/)
    assert.match(html, /旁白/)
  })

  it('splits dialogue and motion on newline', () => {
    const html = buildInlineMotionHtml('你好\n挥手', false)
    assert.match(html, /你好/)
    assert.match(html, /motion-text-gray/)
    assert.match(html, /挥手/)
  })
})
