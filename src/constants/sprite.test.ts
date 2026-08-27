import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SPRITE_BASE_SCALE, spriteBoostFor } from './sprite.ts'

describe('spriteBoostFor', () => {
  it('uses base scale on landscape', () => {
    assert.equal(spriteBoostFor(1.6), SPRITE_BASE_SCALE)
    assert.equal(spriteBoostFor(1), SPRITE_BASE_SCALE)
  })

  it('does not boost portrait', () => {
    assert.equal(spriteBoostFor(0.6), 1)
  })
})
