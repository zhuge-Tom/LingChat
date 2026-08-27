import { ref, watch, nextTick, onUnmounted, type Ref } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { useGameStore } from '@/stores/modules/game'
import { useUIStore } from '@/stores/modules/ui/ui'
import { EMOTION_CONFIG, EMOTION_CONFIG_EMO } from '@/controllers/emotion/config'
import type { GameRole } from '@/stores/modules/game/state'

const BUBBLE_MS = 2000

export function useEmotionPlayback(options: {
  role: Ref<GameRole>
  imageFadeRef: Ref<{ waitForLoad: () => Promise<void> } | null>
  bubbleAudio: Ref<HTMLAudioElement | null>
  restartBubble: boolean
  onAvatarUrl?: (url: string) => void | Promise<void>
}) {
  const gameStore = useGameStore()
  const uiStore = useUIStore()

  const targetAvatarUrl = ref('')
  const activeAnimationClass = ref('normal')
  const isBubbleVisible = ref(false)
  const currentBubbleImageUrl = ref('')
  const currentBubbleClass = ref('')

  let bubbleTimeoutId: number | null = null
  let latestEmotionId = 0
  let resolveAvatarId = 0

  function clearBubbleTimer() {
    if (bubbleTimeoutId !== null) {
      window.clearTimeout(bubbleTimeoutId)
      bubbleTimeoutId = null
    }
  }

  function hideBubble() {
    isBubbleVisible.value = false
    clearBubbleTimer()
  }

  function showBubble(image: string, cls: string) {
    currentBubbleImageUrl.value = image
    currentBubbleClass.value = cls
    clearBubbleTimer()
    const arm = () => {
      isBubbleVisible.value = true
      bubbleTimeoutId = window.setTimeout(() => {
        isBubbleVisible.value = false
        bubbleTimeoutId = null
      }, BUBBLE_MS)
    }
    if (options.restartBubble) {
      isBubbleVisible.value = false
      nextTick(arm)
    } else {
      arm()
    }
  }

  const playBubbleAudio = (src: string) => {
    const el = options.bubbleAudio.value
    if (!el) return
    el.volume = uiStore.bubbleVolume / 100
    el.src = src
    el.load()
    el.play().catch((e) => console.error('气泡音效播放失败:', e))
  }

  async function resolveAvatar() {
    const r = options.role.value
    const clothesName = r.clothesName === '默认' || !r.clothesName ? 'default' : r.clothesName
    const mappedEmotion = EMOTION_CONFIG_EMO[r.emotion] || '正常'
    const currentId = ++resolveAvatarId
    try {
      const path = await invoke<string>('get_avatar_file', {
        characterFolder: r.character_folder,
        emotion: mappedEmotion,
        clothesName,
      })
      if (currentId !== resolveAvatarId) return
      const url = convertFileSrc(path)
      targetAvatarUrl.value = url
      await options.onAvatarUrl?.(url)
    } catch {
      if (currentId === resolveAvatarId) {
        targetAvatarUrl.value = ''
        await options.onAvatarUrl?.('')
      }
    }
  }

  function applyEmotion(emotion: string) {
    const config = EMOTION_CONFIG[emotion]
    if (!config) return
    if (config.animation && config.animation !== 'none') {
      activeAnimationClass.value = config.animation
    }
    if (config.bubbleImage && config.bubbleImage !== 'none') {
      showBubble(config.bubbleImage, config.bubbleClass)
    }
    if (config.audio && config.audio !== 'none') {
      playBubbleAudio(config.audio)
    }
  }

  watch(
    () =>
      [
        options.role.value.roleId,
        options.role.value.emotion,
        options.role.value.clothesName,
        options.role.value.character_folder,
      ] as const,
    async ([, newEmotion]) => {
      const currentId = ++latestEmotionId
      await resolveAvatar()
      await nextTick()
      if (options.imageFadeRef.value) {
        await options.imageFadeRef.value.waitForLoad()
      }
      if (currentId !== latestEmotionId) return
      applyEmotion(newEmotion)
    },
    { immediate: true },
  )

  watch(
    () => uiStore.bubbleVolume,
    (v) => {
      if (options.bubbleAudio.value) options.bubbleAudio.value.volume = v / 100
    },
  )

  watch(
    () => gameStore.currentStatus,
    (newStatus) => {
      if (newStatus === 'thinking') {
        applyEmotion('AI思考')
      } else {
        hideBubble()
      }
    },
  )

  onUnmounted(clearBubbleTimer)

  const handleAnimationEnd = () => {
    if (activeAnimationClass.value !== 'normal') {
      activeAnimationClass.value = 'normal'
    }
  }

  return {
    targetAvatarUrl,
    activeAnimationClass,
    isBubbleVisible,
    currentBubbleImageUrl,
    currentBubbleClass,
    handleAnimationEnd,
  }
}
