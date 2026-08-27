<template>
  <!-- 触摸区域 -->
  <TouchAreas v-if="gameStore.command === 'touch'" :body-parts="role.bodyPart" />

  <Transition name="character-fade">
    <div
      class="absolute w-full h-full pointer-events-none origin-[center_0%] role-container-transition"
      :style="containerStyle"
      @animationend="handleAnimationEnd"
    >
      <!-- 使用单独提取出来的图片淡入淡出组件 -->
      <!-- 原版 LingChat 立绘自带白色辉光（galgame.css 的 drop-shadow），增强与背景的分离感 -->
      <ImageAcrossFade
        ref="imageFadeRef"
        class="absolute w-full h-[102%]"
        :class="containerClasses"
        :style="{ filter: 'drop-shadow(0 0 18px rgba(255, 255, 255, 0.7))' }"
        :src="targetAvatarUrl"
        :duration="300"
        position="center bottom"
        :object-fit="computedObjectFit"
      />

      <!-- 气泡：钉在立绘左上角，带弹出、光晕、闪烁特效 -->
      <div
        v-if="bubbleAnchorStyle"
        class="bubble-anchor"
        :class="bubbleAnchorClasses"
        :style="bubbleAnchorStyle"
      >
        <div class="bubble-halo"></div>
        <div
          :class="bubbleClasses"
          class="bubble"
          :style="{ backgroundImage: `url(${currentBubbleImageUrl})` }"
        >
          <span class="bubble-sparkle s1"></span>
          <span class="bubble-sparkle s2"></span>
          <span class="bubble-sparkle s3"></span>
        </div>
      </div>

      <!-- 情绪音效 -->
      <audio ref="bubbleAudio"></audio>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, toRefs } from 'vue'
import { useGameStore } from '@/stores/modules/game'
import { useUIStore } from '@/stores/modules/ui/ui'
import type { GameRole } from '@/stores/modules/game/state'
import TouchAreas from './TouchAreas.vue'
import ImageAcrossFade from '@/components/ui/ImageAcrossFade.vue'
import { spriteBoostFor } from '@/constants/sprite'
import { useEmotionPlayback } from '@/composables/useEmotionPlayback'
import './avatar-animation.css'

const props = defineProps<{
  role: GameRole
}>()

const gameStore = useGameStore()
const uiStore = useUIStore()
const { role } = toRefs(props)

const bubbleAudio = ref<HTMLAudioElement | null>(null)
const imageFadeRef = ref<InstanceType<typeof ImageAcrossFade> | null>(null)
const spriteNaturalSize = ref<{ w: number; h: number } | null>(null)

async function loadNaturalSize(src: string): Promise<{ w: number; h: number } | null> {
  if (!src) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

const {
  targetAvatarUrl,
  activeAnimationClass,
  isBubbleVisible,
  currentBubbleImageUrl,
  currentBubbleClass,
  handleAnimationEnd,
} = useEmotionPlayback({
  role,
  imageFadeRef,
  bubbleAudio,
  restartBubble: true,
  onAvatarUrl: async (url) => {
    spriteNaturalSize.value = url ? await loadNaturalSize(url) : null
  },
})

// 原版 LingChat 立绘占比更大，这里在角色配置 scale 基础上整体放大到适中大小
const renderScale = computed(() => role.value.scale * spriteBoostFor(uiStore.aspectRatio))

// --- 移动端适配：从 uiStore 读取视口尺寸（全局唯一 resize 监听） ---

// 窄屏适配：宽高比 1.0→0.5 区间，高度 100%→80%（rate=40）
const computedObjectFit = computed(() => {
  const ratio = uiStore.aspectRatio
  if (ratio >= 1.0) return 'contain'
  const percent = Math.max(80, 100 - (1.0 - ratio) * 40)
  return `auto ${Math.round(percent)}%`
})

// 窄屏 Y 轴补偿：同步上述区间，0%→20% 视口高度上移（rate=40）
const narrowScreenYCompensation = computed(() => {
  const ratio = uiStore.aspectRatio
  if (ratio >= 1.0) return 0
  const percent = Math.min(20, (1.0 - ratio) * 40)
  return Math.round((uiStore.viewportHeight * percent) / 100)
})

const wideScreenYCompensation = computed(() => {
  const ratio = uiStore.aspectRatio
  if (ratio < 2.0) return 0
  const percent = Math.min(10, (ratio - 2.0) * 20)
  return Math.round((uiStore.viewportHeight * percent) / 100)
})

// --- 样式计算 ---
const layoutPosition = computed(() => {
  const allIds = gameStore.presentRoleIds
  const myIndex = allIds.indexOf(role.value.roleId)
  const totalCount = allIds.length
  if (myIndex === -1) return 50
  return ((myIndex + 1) / (totalCount + 1)) * 100
})

const lightingFilter = computed(() => {
  const c = gameStore.currentScene?.lighting?.character
  if (!c) return undefined
  const parts: string[] = []
  if (c.brightness !== 1.0) parts.push(`brightness(${c.brightness})`)
  if (c.contrast !== 1.0) parts.push(`contrast(${c.contrast})`)
  if (c.saturation !== 1.0) parts.push(`saturate(${c.saturation})`)
  if (c.glow_radius > 0) parts.push(`drop-shadow(0 0 ${c.glow_radius}px ${c.glow_color})`)
  if (c.sepia > 0) parts.push(`sepia(${c.sepia})`)
  return parts.length > 0 ? parts.join(' ') : undefined
})

const containerStyle = computed(() => {
  const autoLeft = layoutPosition.value
  const manualOffset = role.value.offsetX || 0

  const style: Record<string, string> = {
    left: `calc(${autoLeft}% + ${manualOffset}px)`,
    top: `${role.value.offsetY - narrowScreenYCompensation.value - wideScreenYCompensation.value}px`,
    transform: `translateX(-50%) scale(${renderScale.value})`,
    opacity: `${role.value.show ? 1 : 0}`,
    zIndex: '1',
  }
  const filter = lightingFilter.value
  if (filter) {
    style.filter = filter
  }
  return style
})

const containerClasses = computed(() => ({
  [activeAnimationClass.value]: true,
}))

const bubbleClasses = computed(() => ({
  show: isBubbleVisible.value,
  [currentBubbleClass.value]: isBubbleVisible.value && currentBubbleClass.value,
}))

const bubbleAnchorClasses = computed(() => ({
  'is-active': isBubbleVisible.value,
  [currentBubbleClass.value]: isBubbleVisible.value && currentBubbleClass.value,
}))

// 立绘在图片元素内的实际显示区域（容器未缩放的局部 px，object-fit: center bottom）
const spriteRect = computed(() => {
  const nat = spriteNaturalSize.value
  if (!nat || !nat.w || !nat.h) return null
  const W = uiStore.viewportWidth
  const H = uiStore.viewportHeight * 1.02 // ImageAcrossFade 元素为 h-[102%]
  let dw: number
  let dh: number
  const m = /^auto\s+([\d.]+)%$/.exec(computedObjectFit.value)
  if (m) {
    dh = (H * parseFloat(m[1])) / 100
    dw = nat.w * (dh / nat.h)
  } else {
    const k = Math.min(W / nat.w, H / nat.h)
    dw = nat.w * k
    dh = nat.h * k
  }
  return { x: (W - dw) / 2, y: H - dh, w: dw, h: dh }
})

const bubbleAnchorStyle = computed(() => {
  const rect = spriteRect.value
  if (!rect) return null
  const s = renderScale.value || 1
  const boxH = (uiStore.viewportHeight * 0.22) / s
  const boxW = boxH * 0.9
  return {
    left: `${rect.x - boxW * 0.28}px`,
    top: `${rect.y - boxH * 0.12}px`,
    width: `${boxW}px`,
    height: `${boxH}px`,
  }
})


</script>

<style scoped>
.role-container-transition {
  transition:
    left 0.5s cubic-bezier(0.25, 0.8, 0.5, 1),
    top 0.3s ease,
    opacity 0.3s ease-in-out;
}

/* --- 角色进场/退场动画 (Vue Transition 组件必需的样式) --- */
.character-fade-enter-active,
.character-fade-leave-active {
  transition:
    opacity 0.5s ease-in-out,
    transform 0.5s ease-out;
}

.character-fade-enter-from,
.character-fade-leave-to {
  opacity: 0;
}

:deep(.touch-area) {
  pointer-events: auto;
}
</style>
