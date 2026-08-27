import { ref, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function useDialogScreenshot(onFail: () => Promise<void>) {
  const hasScreenshot = ref(false)
  const screenshotBase64 = ref<string | null>(null)
  const isCapturing = ref(false)
  let unlistenCaptured: (() => void) | null = null
  let unlistenCancelled: (() => void) | null = null

  const bind = async () => {
    unlistenCaptured = await listen<{ base64: string }>('screenshot:captured', (event) => {
      screenshotBase64.value = event.payload.base64
      hasScreenshot.value = true
      isCapturing.value = false
    })
    unlistenCancelled = await listen('screenshot:cancelled', () => {
      isCapturing.value = false
      hasScreenshot.value = false
    })
  }

  const startScreenshot = async () => {
    if (isCapturing.value) return
    isCapturing.value = true
    try {
      await invoke('start_screenshot')
    } catch (error) {
      console.error('启动截图失败:', error)
      isCapturing.value = false
      await onFail()
    }
  }

  const clearScreenshot = () => {
    hasScreenshot.value = false
    screenshotBase64.value = null
  }

  onUnmounted(() => {
    unlistenCaptured?.()
    unlistenCancelled?.()
  })

  return { hasScreenshot, screenshotBase64, isCapturing, bind, startScreenshot, clearScreenshot }
}
