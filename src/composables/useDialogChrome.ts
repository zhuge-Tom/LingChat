import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useGameStore } from '@/stores/modules/game'
import { useUIStore } from '@/stores/modules/ui/ui'

export function useDialogChrome(isRecording: { value: boolean }, interimText: { value: string }) {
  const { t } = useI18n()
  const gameStore = useGameStore()
  const uiStore = useUIStore()

  const isInputEnabled = computed(() => gameStore.currentStatus === 'input')
  const isSending = computed(() => gameStore.currentStatus === 'thinking')

  const placeholderText = computed(() => {
    if (isRecording.value) {
      return interimText.value || t('game.dialog.listening')
    }
    switch (gameStore.currentStatus) {
      case 'input':
        return uiStore.showPlayerHintLine || t('game.dialog.inputPlaceholder')
      case 'thinking': {
        const role = gameStore.currentInteractRole
        if (!role) return t('game.dialog.waitingResponse')
        if (gameStore.thinkingLength > 0) {
          return `${role.thinkMessage}${t('game.dialog.thinkingDepth', { count: gameStore.thinkingLength })}`
        }
        return role.thinkMessage
      }
      case 'responding':
      case 'presenting':
        return ''
      default:
        return t('game.dialog.inputPlaceholder')
    }
  })

  watch(
    () => gameStore.currentStatus,
    (newStatus) => {
      if (newStatus === 'thinking') {
        const role = gameStore.currentInteractRole
        if (role) {
          uiStore.showCharacterTitle = role.roleName
          uiStore.showCharacterSubtitle = role.roleSubTitle
        }
      } else if (newStatus === 'input') {
        uiStore.showCharacterTitle = gameStore.userName
        uiStore.showCharacterSubtitle = gameStore.userSubtitle
        uiStore.showCharacterEmotion = ''
      } else if (newStatus === 'presenting') {
        uiStore.showCharacterTitle = ''
        uiStore.showCharacterSubtitle = ''
        uiStore.showCharacterEmotion = ''
        uiStore.showCharacterLine = ''
      }
    },
  )

  return { placeholderText, isInputEnabled, isSending }
}
