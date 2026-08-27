<template>
  <router-view />
  <!-- 将光标特效 teleport 到 body，避免 #app 上的 CSS zoom 导致坐标偏移 -->
  <Teleport to="body">
    <CursorEffects
      v-if="
        isMainWindow &&
        route.path !== '/pet' &&
        (settingsStore.globalMouseTrailEnabled || settingsStore.clickAnimationEnabled)
      "
    />
  </Teleport>

  <!-- 全局通知组件（直接从 uiStore 读取状态） -->
  <!-- 与桌宠专用通知组件区分开 -->
  <!-- 弹窗类组件仅主窗口挂载：日志等独立窗口复用 App.vue，不重复弹出 -->
  <Notification v-if="isMainWindow && route.path !== '/pet'" />
  <AchievementToast v-if="isMainWindow && route.path !== '/pet'" />
  <AdventureUnlockNotify v-if="isMainWindow && route.path !== '/pet'" />
  <AppDialog v-if="isMainWindow" />
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import CursorEffects from './components/effects/CursorEffects.vue'
import Notification from './components/ui/Notification.vue'
import AchievementToast from './components/ui/AchievementToast.vue'
import AdventureUnlockNotify from './components/ui/AdventureUnlockNotify.vue'
import AppDialog from './components/ui/AppDialog.vue'
import { initUIStore } from './stores/modules/ui/ui'
import { i18n } from './locales'
import { useSettingsStore } from './stores/modules/settings'
import { useLlmProvidersStore } from './stores/modules/llm-providers'
import { useAchievementStore } from './stores/modules/ui/achievement'
import { useDialogStore } from './stores/modules/ui/dialog'
import { useSedentaryReminder } from './composables/useSedentaryReminder'
import { useCanDeliver } from './composables/useCanDeliver'
import { useZoom } from './composables/useZoom'
import { listSystemFonts, getImportedFonts, registerAllImportedFonts } from './api/services/font'

// ─── 激活主动对话投放条件上报（仅在此处挂载一次） ────────────
useCanDeliver()

// 激活 Ctrl+滚轮 UI 全局缩放
useZoom()

// ─── 久坐提醒 ────────────────────────────────────────────────
useSedentaryReminder()

// ─── 全局字体 ────────────────────────────────────────────────
// 把设置中的自定义字体名同步到 <html> 的 --font-app；
// 为空时 base.css 中的回退栈 --font-sans 生效。初始菜单 / 加载页因自带
// 显式 font-family 不会继承此变量，自动保持原有字体。
const settingsStore = useSettingsStore()
const route = useRoute()
const isMainWindow = getCurrentWindow().label === 'main'

function applyFont(font?: string) {
  document.documentElement.style.setProperty('--font-app', font ? `'${font}'` : '')
}
watch(() => settingsStore.text.fontFamily, applyFont, { immediate: true })

if (isMainWindow) {
  void listSystemFonts()
  void getImportedFonts().then((fonts) => {
    registerAllImportedFonts(fonts)
  })
}

const handleKeyDown = async (event: KeyboardEvent) => {
  if (event.key === 'F11') {
    event.preventDefault()

    // Pet 路由时不允许全屏
    if (route.path === '/pet') {
      return
    }

    try {
      const appWindow = getCurrentWindow()
      const isFullscreen = await appWindow.isFullscreen()
      await appWindow.setFullscreen(!isFullscreen)
    } catch (e) {
      console.error('全屏切换失败:', e)
    }
  }
}

// ─── 关闭确认 ────────────────────────────────────────────────

const dialogStore = useDialogStore()
let saveCompleted = false
let userConfirmedExit = false
let unlistenCloseReady: (() => void) | null = null
let unlistenCloseRequested: (() => void) | null = null

// 处理退出：两个条件都满足时调用 Rust exit_app
function tryExit() {
  if (saveCompleted && userConfirmedExit) {
    invoke('exit_app')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeyDown)

  if (!isMainWindow) return

  initUIStore()

  if (localStorage.getItem('lingchat_log_window_auto_open') === '1') {
    invoke('open_log_window').catch((e) => console.error('自动打开日志窗口失败:', e))
  }

  const llmStore = useLlmProvidersStore()
  llmStore.load().catch((e) => console.error('加载 LLM 提供商失败:', e))

  const achievementStore = useAchievementStore()
  ;(window as any).requestAchievementUnlock = (data: any) =>
    achievementStore.notifyBackendUnlock(data)
  ;(window as any).showAchievement = (data: any) => achievementStore.addAchievement(data)
  achievementStore.listenForUnlocks()

  // ─── 关闭确认逻辑 ──────────────────────────────────────────

  // 1. 监听 Rust 存档完成事件
  unlistenCloseReady = await listen('app:close-ready', () => {
    saveCompleted = true
    tryExit()
  })

  // 2. 拦截窗口关闭请求（仅主窗口需要确认，其他窗口正常关闭）
  unlistenCloseRequested = await getCurrentWindow().onCloseRequested(
    async (event: { preventDefault: () => void }) => {
      if (getCurrentWindow().label !== 'main') return

      event.preventDefault()

      // 重置状态
      saveCompleted = false
      userConfirmedExit = false

      if (route.path === '/chat') {
        const confirmed = await dialogStore.confirm(
          i18n.global.t('common.exitMessage'),
          i18n.global.t('common.exitTitle'),
        )
        if (!confirmed) return // 用户取消，窗口保持打开
      }

      userConfirmedExit = true
      tryExit()
    },
  )
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (unlistenCloseReady) unlistenCloseReady()
  if (unlistenCloseRequested) unlistenCloseRequested()
})
</script>

<style>
:root {
  /*全局变量*/
  --accent-color: #79d9ff;
  --menu-max-width: 1100px;
  --menu-max-width-half: 550px;
  /* 一个生动的天蓝色，可以根据你的品牌调整 */
}

/* 全局样式和字体 */
body,
html {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: transparent;
}

#app {
  width: 100vw;
  height: 100vh;
}
</style>
