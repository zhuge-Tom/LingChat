import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { EMOTION_CONFIG } from './config.ts'

describe('EMOTION_CONFIG', () => {
  it('uses root-absolute asset paths', () => {
    for (const cfg of Object.values(EMOTION_CONFIG)) {
      if (cfg.bubbleImage !== 'none') {
        assert.ok(cfg.bubbleImage.startsWith('/pictures/animation/'))
      }
      if (cfg.audio !== 'none') {
        assert.ok(cfg.audio.startsWith('/audio_effects/'))
      }
    }
  })

  it('has thinking bubble', () => {
    assert.notEqual(EMOTION_CONFIG['AI思考']?.bubbleImage, 'none')
  })
})
