<template>
  <transition appear :css="false" @before-enter="beforeEnter" @enter="enter" @leave="leave">
    <div
      v-if="isVisible"
      class="fixed inset-0 flex flex-col items-center justify-center pointer-events-none z-998"
    >
      <!-- 中央遮罩：两端渐隐，避免生硬的横线切割感 -->
      <div class="relative w-full py-16 flex flex-col items-center justify-center bg-slate-900/30 backdrop-blur-md">
        <div class="absolute inset-0 glass-fade-mask -z-10"></div>

        <!-- 内容区域 -->
        <div class="relative z-10 flex flex-col items-center">
          <div class="flex items-center gap-5 mb-4 opacity-90">
            <div class="h-px w-16 bg-linear-to-r from-transparent to-brand/70"></div>

            <svg
              class="w-4 h-4 text-brand animate-star-spin drop-shadow-[0_0_8px_rgba(var(--color-brand),0.8)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1L14.5 8.5L22 11L14.5 13.5L12 21L9.5 13.5L2 11L9.5 8.5L12 1Z" />
            </svg>
            <svg
              class="w-3 h-3 text-brand/70 animate-star-spin-reverse drop-shadow-[0_0_8px_rgba(var(--color-brand),0.6)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1L14.5 8.5L22 11L14.5 13.5L12 21L9.5 13.5L2 11L9.5 8.5L12 1Z" />
            </svg>
            <svg
              class="w-4 h-4 text-brand animate-star-spin-reverse drop-shadow-[0_0_8px_rgba(var(--color-brand),0.8)]"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 1L14.5 8.5L22 11L14.5 13.5L12 21L9.5 13.5L2 11L9.5 8.5L12 1Z" />
            </svg>

            <div class="h-px w-16 bg-linear-to-l from-transparent to-brand/70"></div>
          </div>

          <!-- 章节名主标题 -->
          <h2
            class="text-3xl md:text-4xl font-bold text-white tracking-[0.3em] drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] text-shadow-glow pl-[0.3em] text-center px-8"
          >
            {{ uiStore.chapterCardText }}
          </h2>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useUIStore } from '@/stores/modules/ui/ui'

const uiStore = useUIStore()

const isVisible = ref(false)
let hideTimer: number | null = null

// 监听章节卡序号变化（章节切换事件触发）
watch(
  () => uiStore.chapterCardSeq,
  (seq) => {
    if (seq <= 0 || uiStore.chapterCardText === '') return

    isVisible.value = true

    if (hideTimer !== null) clearTimeout(hideTimer)
    // 展示 2.4 秒后自动淡出（章节事件不阻塞事件队列，纯视觉层）
    hideTimer = window.setTimeout(() => {
      isVisible.value = false
      hideTimer = null
    }, 2400)
  },
)

function beforeEnter(el: Element) {
  const element = el as HTMLElement
  element.style.opacity = '0'
  element.style.transform = 'scale(1.06)'
  element.style.filter = 'blur(10px)'
  element.style.transition = 'all 0.7s cubic-bezier(0.2, 0.8, 0.2, 1)'
}

function enter(el: Element, done: () => void) {
  const element = el as HTMLElement
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.style.opacity = '1'
      element.style.transform = 'scale(1)'
      element.style.filter = 'blur(0px)'
      setTimeout(done, 700)
    })
  })
}

function leave(el: Element, done: () => void) {
  const element = el as HTMLElement
  element.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
  element.style.opacity = '0'
  element.style.transform = 'scale(0.98)'
  element.style.filter = 'blur(6px)'
  setTimeout(done, 600)
}
</script>

<style scoped>
/* 两端透明渐变遮罩 */
.glass-fade-mask {
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 25%,
    black 75%,
    transparent 100%
  );
  mask-image: linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%);
}

@keyframes star-spin {
  0% {
    transform: rotate(0deg) scale(0.9);
    opacity: 0.7;
  }
  50% {
    transform: rotate(180deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: rotate(360deg) scale(0.9);
    opacity: 0.7;
  }
}

@keyframes star-spin-reverse {
  0% {
    transform: rotate(0deg) scale(0.9);
    opacity: 0.7;
  }
  50% {
    transform: rotate(-180deg) scale(1.1);
    opacity: 1;
  }
  100% {
    transform: rotate(-360deg) scale(0.9);
    opacity: 0.7;
  }
}

.animate-star-spin {
  animation: star-spin 4s linear infinite;
}

.animate-star-spin-reverse {
  animation: star-spin-reverse 4s linear infinite;
}

.text-shadow-glow {
  text-shadow:
    0 0 16px rgba(0, 0, 0, 0.9),
    0 0 12px rgba(var(--color-brand), 0.45);
}
</style>
