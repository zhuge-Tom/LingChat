import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'
import type { Ref } from 'vue'
import { useGameStore } from '@/stores/modules/game'
import { useUIStore } from '@/stores/modules/ui/ui'
import { useLlmProvidersStore } from '@/stores/modules/llm-providers'
import { eventQueue } from '@/core/events/event-queue'

export function useDialogSend(opts: {
  inputMessage: Ref<string>
  screenshotBase64: Ref<string | null>
  hasScreenshot: Ref<boolean>
  isInlineMotion: () => boolean
  isInlineTyping: () => boolean
  finishInlineTyping: () => void
  isShowingMotionText: Ref<boolean>
  startTextTyping: (text: string, speed: number) => void
  emit: (event: 'player-continued' | 'dialog-proceed') => void
}) {
  const { t } = useI18n()
  const gameStore = useGameStore()
  const uiStore = useUIStore()
  const llmStore = useLlmProvidersStore()

  function send() {
    const text = opts.inputMessage.value
    if (!text.trim()) return

    if (!llmStore.chatProviderId) {
      uiStore.showNotification({
        type: 'warning',
        title: t('game.dialog.noModelTitle'),
        message: t('game.dialog.noModelMessage'),
        skipTipsCheck: true,
      })
      return
    }

    gameStore.appendGameMessage({
      type: 'message',
      displayName: gameStore.userName,
      content: text,
    })

    if (gameStore.runningScript) {
      const script = gameStore.runningScript
      const wasChoice = script.choices.length > 0
      invoke('script_submit_input', { input: text })
        .then(() => {
          script.choices = []
          if (script.freeDialogueInfo.isFreeDialogue) {
            script.freeDialogueInfo.currentRound++
          }
        })
        .catch((error) => {
          console.error('发送脚本输入失败:', error)
          gameStore.currentStatus = 'input'
          uiStore.showNotification({
            type: 'warning',
            title: wasChoice ? '请点击一个选项' : '当前无法输入',
            message: String(error),
            skipTipsCheck: true,
          })
        })
    } else {
      invoke('send_chat_message', {
        text,
        screenshotBase64: opts.screenshotBase64.value,
      }).catch((error) => {
        console.error('发送消息失败:', error)
        gameStore.currentStatus = 'input'
      })
    }

    opts.hasScreenshot.value = false
    opts.screenshotBase64.value = null
    opts.inputMessage.value = ''
  }

  function continueDialog(isPlayerTrigger: boolean): boolean {
    if (opts.isInlineMotion()) {
      if (opts.isInlineTyping()) {
        opts.finishInlineTyping()
        return false
      }
      const needWait = eventQueue.continue()
      if (!needWait) {
        uiStore.showCharacterMotionText = ''
        if (isPlayerTrigger) opts.emit('player-continued')
        opts.emit('dialog-proceed')
      }
      return needWait
    }

    if (opts.isShowingMotionText.value) {
      opts.isShowingMotionText.value = false
      uiStore.showCharacterMotionText = ''
    } else if (uiStore.showCharacterMotionText) {
      opts.isShowingMotionText.value = true
      opts.startTextTyping(uiStore.showCharacterMotionText, uiStore.typeWriterSpeed)
      return false
    }

    const needWait = eventQueue.continue()
    if (!needWait) {
      if (isPlayerTrigger) opts.emit('player-continued')
      opts.emit('dialog-proceed')
    }
    return needWait
  }

  function sendOrContinue() {
    if (gameStore.currentStatus === 'input') send()
    else if (gameStore.currentStatus === 'responding') continueDialog(true)
  }

  return { send, continueDialog, sendOrContinue }
}
