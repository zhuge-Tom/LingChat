<template>
  <div
    class="relative
      z-2
      flex
      w-full
      scrollbar-thin
      [scrollbar-color:var(--accent-color)_transparent]
      justify-center
      px-5
      pt-4
      pb-3.5
      transition-all
      duration-200
      ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
      before:pointer-events-none
      before:absolute
      before:-top-10
      before:right-0
      before:left-0
      before:h-14
      before:bg-linear-to-b
      before:from-transparent
      before:via-[rgba(0,14,39,0.18)]
      before:to-[rgba(0,14,39,0.45)]
      before:content-['']"
    :class="{
      [`z-[-1]!
      overflow-hidden
      opacity-0
      translate-y-6
      duration-500!
      ease-linear
      before:opacity-0
      before:duration-1000!`]: isHidden,
      'max-h-[40vh]': !uiStore.isNarrowScreen,
    }"
    :style="dialogWrapperStyle"
    @wheel="handleWheelHistory"
  >
    <div
      :style="{ width: containerWidth + '%' }"
      class="relative"
    >
      <div class="overflow-y-auto">
        <!-- 标题栏 -->
        <div class="mb-2.5
          flex
          flex-wrap
          items-center">
          <!-- 角色名称 -->
          <div
            class="nameplate
              mr-3
              font-[inherit]
              text-[1.7rem]
              font-bold
              leading-tight
              text-shadow-[inherit]"
            :class="{
              [`min-w-0
              overflow-hidden
              text-ellipsis
              whitespace-nowrap`]: uiStore.isNarrowScreen,
            }"
            :style="{ color: dialogTextColorValue }"
          >
            <div id="character">{{ uiStore.showCharacterTitle }}</div>
          </div>
          <div
            v-show="!uiStore.isNarrowScreen && uiStore.showCharacterSubtitle"
            class="font-[inherit]
              text-lg
              font-semibold
              tracking-wide
              text-[#8ec5ff]/90
              text-shadow-[inherit]"
          >
            <div id="character-sub">{{ uiStore.showCharacterSubtitle }}</div>
          </div>

          <Transition name="emotion-pop" mode="out-in">
            <div
              v-if="uiStore.showCharacterEmotion"
              id="character-emotion"
              :key="uiStore.showCharacterEmotion"
              class="emotion-chip"
            >
              {{ uiStore.showCharacterEmotion }}
            </div>
          </Transition>

          <GameDialogActions
            :is-mobile="isMobile"
            :narrow="uiStore.isNarrowScreen"
            v-model:show-mobile-menu="showMobileMenu"
            :is-recording="isRecording"
            :has-screenshot="hasScreenshot"
            :screenshot-base64="screenshotBase64"
            @scene="openSceneSettings"
            @history="openHistory"
            @record="toggleRecording"
            @screenshot="startScreenshot"
            @clear-screenshot="clearScreenshot"
            @close="removeDialog"
            @touch="toggleTouchMode"
            @exit-touch="exitTouchMode"
          />
        </div>

        <!-- 分割线 -->
        <div class="dialog-rule"></div>

        <!-- 输入区 -->
        <div
          class="my-1.25
            flex
            min-h-10
            w-full
            resize-none
            flex-col
            border-none
            bg-transparent
            text-xl
            font-bold
            whitespace-pre-line
            text-white
            transition-all
            duration-300
            outline-none"
        >
          <!-- 内联动作文本显示区（仅内联模式+回应状态时可见） -->
          <div
            v-show="isInlineDisplayMode"
            ref="inlineDisplayRef"
            tabindex="0"
            class="inline-motion-display
              my-1.25
              max-h-[50vh]
              min-h-32
              flex-1
              resize-none
              overflow-y-auto
              border-none
              bg-transparent
              font-[inherit]
              text-2xl
              font-bold
              whitespace-pre-line
              outline-none
              text-shadow-[inherit]"
            :class="{ 'typing-caret': isTyping }"
            @keydown.enter.exact.prevent="sendOrContinue"
          ></div>

          <!-- 标准 textarea（输入模式或非内联显示模式） -->
          <textarea
            v-show="!isInlineDisplayMode"
            id="inputMessage"
            ref="textareaRef"
            class="my-1.25
              max-h-[50vh]
              min-h-32
              flex-1
              resize-none
              border-none
              bg-transparent
              font-[inherit]
              text-2xl
              font-bold
              transition-all
              duration-300
              outline-none
              text-shadow-[inherit]
              placeholder:text-white/50
              placeholder:shadow-none"
            :class="[textareaMotionClass, { 'typing-caret-border': isTyping }]"
            :placeholder="placeholderText"
            v-model="inputMessage"
            @keydown.enter.exact.prevent="sendOrContinue"
            :readonly="!isInputEnabled"
          ></textarea>
        </div>
      </div>
      <!-- 发送按钮（内层右侧外部；原版为 20px 加粗并横向拉伸的 ▼） -->
      <button
        id="sendButton"
        class="continue-btn"
        :class="{ 'continue-pulse': gameStore.currentStatus === 'responding' }"
        :disabled="isSending"
        @click="sendOrContinue"
      >
        ▼
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import GameDialogActions from './GameDialogActions.vue'
import { useGameStore } from '../../../stores/modules/game'
import { useUIStore } from '../../../stores/modules/ui/ui'
import { useDialogStore } from '../../../stores/modules/ui/dialog'
import { useSettingsStore } from '../../../stores/modules/settings'
import { useTypeWriter } from '../../../composables/ui/useTypeWriter'
import { useDialogAppearance } from '../../../composables/useDialogAppearance'
import { buildInlineMotionHtml } from '../../../utils/inlineMotionHtml'
import { setInputHasText } from '../../../composables/useCanDeliver'
import { useSpeechRecognition } from '../../../composables/useSpeechRecognition'
import { useDialogScreenshot } from '../../../composables/useDialogScreenshot'
import { useTouchMode } from '../../../composables/useTouchMode'
import { useDialogSend } from '../../../composables/useDialogSend'
import { useDialogChrome } from '../../../composables/useDialogChrome'

const inputMessage = ref('')
const { t } = useI18n()
// 输入框内容变化 → 通知 can_deliver 追踪
watch(inputMessage, (val) => setInputHasText(Boolean(val.trim())), { immediate: true })
const isShowingMotionText = ref(false)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const inlineDisplayRef = ref<HTMLDivElement | null>(null)
const gameStore = useGameStore()
const uiStore = useUIStore()
const dialogStore = useDialogStore()
const settingsStore = useSettingsStore()

// Dialog appearance managed by composable: useDialogAppearance
const { isHidden, hide, dialogWrapperStyle, dialogTextColorValue, handleWheelHistory } =
  useDialogAppearance({
    openHistory: () => {
      uiStore.toggleSettings(true)
      uiStore.setSettingsTab('history')
    },
  })

// 移动端按钮折叠状态（但是基于长宽比判断）
const isMobile = ref(uiStore.aspectRatio <= 1)
const showMobileMenu = ref(false)

// 内联显示模式：设置开启 + 回应状态 → 用 div 做混色显示
const isInlineDisplayMode = computed(
  () => settingsStore.text.inlineMotionText && gameStore.currentStatus === 'responding',
)

const {
  isRecording,
  interimText,
  init: initSpeechRecognition,
  toggleRecording,
} = useSpeechRecognition({
  onFinal: (text) => {
    inputMessage.value = text
    send()
  },
  canStart: () => gameStore.currentStatus === 'input',
  onBlocked: () => dialogStore.alert(t('game.dialog.inputNotAllowed')),
  onUnsupported: () => dialogStore.alert(t('game.dialog.speechNotSupported')),
})

const { hasScreenshot, screenshotBase64, isCapturing, bind: bindScreenshot, startScreenshot, clearScreenshot } =
  useDialogScreenshot(() => dialogStore.alert(t('game.dialog.screenshotFailed')))
const { toggleTouchMode, exitTouchMode } = useTouchMode()
const { placeholderText, isInputEnabled, isSending } = useDialogChrome(isRecording, interimText)

// 响应式容器宽度（窄屏判断从 uiStore 读取）
const containerWidth = ref(60)

const updateContainerWidth = () => {
  containerWidth.value = Math.max(60, uiStore.aspectRatio > 1 ? 75 : 90)
  isMobile.value = uiStore.aspectRatio <= 1
  if (!isMobile.value) showMobileMenu.value = false
}

const openSceneSettings = () => {
  uiStore.toggleSettings(true)
  uiStore.setSettingsTab('background')
}

// 移动端菜单操作：执行动作后自动收起菜单
const currentDisplayedText = ref('')

function writeInlineHtml(_element: HTMLElement, text: string): void {
  if (!inlineDisplayRef.value) return
  inlineDisplayRef.value.innerHTML = buildInlineMotionHtml(text, uiStore.isNarrationLine)
}

// 立即把当前台词写入显示元素（不经过打字动画；供挂载恢复使用）
function renderLineInstant(line: string) {
  currentDisplayedText.value = line
  if (settingsStore.text.inlineMotionText) {
    const text = uiStore.showCharacterMotionText
      ? line + '\n' + uiStore.showCharacterMotionText
      : line
    if (inlineDisplayRef.value) writeInlineHtml(inlineDisplayRef.value, text)
  } else if (textareaRef.value) {
    textareaRef.value.value = line
    inputMessage.value = line // 与 v-model 同步，防止重渲染把值重置为空
  }
}

// 标准模式 TypeWriter（textarea）
const {
  startTyping: startTextTyping,
  stopTyping: stopTextTyping,
  isTyping: isTextTyping,
} = useTypeWriter(textareaRef, (text) => {
  currentDisplayedText.value = text
})

// 内联模式 TypeWriter（div + HTML 混色渲染）
const {
  startTyping: startInlineTyping,
  stopTyping: stopInlineTyping,
  isTyping: isInlineTyping,
  finishTyping: finishInlineTyping,
} = useTypeWriter(
  inlineDisplayRef,
  (text) => {
    currentDisplayedText.value = text
  },
  writeInlineHtml,
)

// 统一 isTyping（父组件通过 defineExpose 使用）
const isTyping = computed(() =>
  isInlineDisplayMode.value ? isInlineTyping.value : isTextTyping.value,
)

// textarea 动态样式（仅两段式模式使用；内联模式用 div 渲染，不需要此 class）
const textareaMotionClass = computed(() => {
  if (uiStore.isNarrationLine) return { 'narration-textarea': true }
  if (!isShowingMotionText.value) return {}
  return { 'italic text-white/50 text-xl': true }
})

const emit = defineEmits(['player-continued', 'dialog-proceed'])
const { send, continueDialog, sendOrContinue } = useDialogSend({
  inputMessage,
  screenshotBase64,
  hasScreenshot,
  isInlineMotion: () => isInlineDisplayMode.value,
  isInlineTyping: () => isInlineTyping.value,
  finishInlineTyping,
  isShowingMotionText,
  startTextTyping,
  emit: (event) => emit(event),
})

const openHistory = () => {
  uiStore.toggleSettings(true)
  uiStore.setSettingsTab('history')
}

const handleDialogShow = (e: MouseEvent) => {
  if (isHidden.value) {
    e.preventDefault()
    isHidden.value = false
  }
}

watch([() => uiStore.showCharacterLine, () => gameStore.currentStatus], ([newLine, newStatus]) => {
  if (newLine && newLine !== '' && newStatus === 'responding') {
    inputMessage.value = ''
    currentDisplayedText.value = ''
    isShowingMotionText.value = false

    // 内联模式：始终用 div 渲染（有动作文本时拼接换行+灰字，无则仅白字）
    if (settingsStore.text.inlineMotionText) {
      const text = uiStore.showCharacterMotionText
        ? newLine + '\n' + uiStore.showCharacterMotionText
        : newLine
      startInlineTyping(text, uiStore.typeWriterSpeed)
    } else {
      startTextTyping(newLine, uiStore.typeWriterSpeed)
    }
  } else if (newStatus === 'input') {
    stopTextTyping()
    stopInlineTyping()
    isShowingMotionText.value = false
    uiStore.isNarrationLine = false
    inputMessage.value = ''
    currentDisplayedText.value = ''
  }
})

// 内联模式 div 可见时自动聚焦，确保 Enter 键能推进对话
watch(isInlineDisplayMode, (visible) => {
  if (visible) {
    // nextTick 确保 v-show 已生效、DOM 已渲染
    setTimeout(() => inlineDisplayRef.value?.focus(), 0)
  }
})



onMounted(async () => {
  // 模式切换重挂载：立即从 store 恢复当前台词（不重播打字动画）
  const restoreLine = uiStore.showCharacterLine
  if (restoreLine && restoreLine !== '' && gameStore.currentStatus === 'responding') {
    renderLineInstant(restoreLine)
  }

  document.addEventListener('contextmenu', handleDialogShow)
  // 初始化语音识别对象
  initSpeechRecognition()
  // 初始化容器宽度
  updateContainerWidth()
  // 监听窗口大小变化
  window.addEventListener('resize', updateContainerWidth)

  await bindScreenshot()
})

onUnmounted(() => {
  document.removeEventListener('contextmenu', handleDialogShow)
  window.removeEventListener('resize', updateContainerWidth)
})

function removeDialog() {
  hide()
}

// ── 对话框外观（响应 settings store） ──
// Dialog appearance logic extracted to composable: useDialogAppearance

defineExpose({
  continueDialog,
  isTyping, // 统一 computed：内联模式用 div 实例，否则用 textarea 实例
})
</script>

<style scoped>
.nameplate {
  padding-left: 10px;
  border-left: 3px solid var(--accent-color, #6eb4ff);
}
.emotion-chip {
  margin-left: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #ffd0ef;
  background: rgba(255, 119, 221, 0.16);
  border: 1px solid rgba(255, 119, 221, 0.28);
}
.dialog-rule {
  height: 1px;
  margin: 8px 0 10px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.38), transparent);
}
.continue-btn {
  position: absolute;
  right: 0;
  bottom: 6px;
  transform: translateX(118%);
  width: 36px;
  height: 36px;
  border: 1px solid rgba(110, 180, 255, 0.35);
  border-radius: 999px;
  background: rgba(4, 188, 255, 0.12);
  color: #7de7ff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease;
}
.continue-btn:hover:not(:disabled) {
  background: rgba(4, 188, 255, 0.28);
  color: #e8fbff;
  transform: translateX(118%) translateY(-1px);
}
.continue-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.inline-motion-display {
  color: #9ca3af;
}

/* 打字机进行中的闪烁光标（galgame 经典效果）：div 用块状光标，textarea 用右边框 */
.typing-caret::after {
  content: '▌';
  margin-left: 2px;
  color: var(--accent-color, #6eb4ff);
  animation: caret-blink 0.8s steps(1) infinite;
}
.typing-caret-border {
  border-right: 3px solid var(--accent-color, #6eb4ff);
  animation: caret-border-blink 0.8s steps(1) infinite;
}
@keyframes caret-blink {
  50% {
    opacity: 0;
  }
}
@keyframes caret-border-blink {
  50% {
    border-right-color: transparent;
  }
}

/* 回应状态下 ▼ 按钮呼吸提示：提醒玩家点击推进对话 */
.continue-pulse {
  animation: soft-pulse 1.6s ease-in-out infinite;
}
@keyframes soft-pulse {
  0%,
  100% {
    opacity: 0.45;
  }
  50% {
    opacity: 1;
  }
}

/* 情绪标签切换：缩小淡出 → 弹性放大进入 */
.emotion-pop-enter-active {
  animation: emotion-pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.emotion-pop-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.emotion-pop-enter-from,
.emotion-pop-leave-to {
  opacity: 0;
}
.emotion-pop-leave-from {
  opacity: 1;
}
@keyframes emotion-pop-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 内联模式下的动作文本灰字 span（通过 writeInlineHtml 写入 innerHTML） */
.motion-text-gray {
  color: #9ca3af !important;
}

/* 剧本旁白的电影化样式：斜体、浅灰蓝、加宽字距（区别于角色台词） */
.narration-inline {
  color: #cbd5e1;
  font-style: italic;
  letter-spacing: 0.08em;
}
.narration-textarea {
  color: #cbd5e1 !important;
  font-style: italic;
  letter-spacing: 0.08em;
}

</style>
