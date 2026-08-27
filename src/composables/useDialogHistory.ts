import { computed, nextTick, ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { invoke } from '@tauri-apps/api/core'
import { useGameStore } from '@/stores/modules/game'
import { useUIStore } from '@/stores/modules/ui/ui'
import { useDialogStore } from '@/stores/modules/ui/dialog'
import { convertInitLines } from '@/stores/modules/game/actions'
import { eventQueue } from '@/core/events/event-queue'
import { getVoiceAudio } from '@/api/services/game-info'
import { hkify } from '@/locales'
import type { GameMessage } from '@/stores/modules/game/state'
import type { GameLineInit } from '@/api/services/game-info'
import { parseHistorySegments, type HistorySegment } from '@/utils/historySegments'

export type { HistorySegment }

export interface HistoryLineEntry {
  segments: HistorySegment[]
  audioFile?: string
  userMessageSeq?: number
  thinking?: string
  absIndex: number
  lineSeq?: number
}

export interface HistoryBlock {
  displayName: string
  isNarration: boolean
  lines: HistoryLineEntry[]
  userMessageSeq?: number
  thinking?: string
}

const PAGE_SIZE = 100
const NARRATION_NAMES = new Set(['', '旁白', '系统', 'Narrator', 'System'])

export function useDialogHistory(labels: {
  you: string
  mysteryVoice: string
  backtrackConfirm: string
  backtrackTitle: string
  backtrackFailed: string
  generateFailed: string
}) {
  const gameStore = useGameStore()
  const uiStore = useUIStore()
  const dialogStore = useDialogStore()
  const { t, locale } = useI18n()
  const youLabel = () => t(labels.you)
  const mysteryLabel = () => t(labels.mysteryVoice)
  const audioRef = ref<HTMLAudioElement>()
  const contentRef = ref<HTMLDivElement>()
  const currentPage = ref(1)
  const expandedThinking = ref<Set<number>>(new Set())
  const generatingVoiceKeys = ref<Set<string>>(new Set())
  let suppressAutoScroll = false

  const dialogHistory = computed<GameMessage[]>(() => gameStore.dialogHistory)
  const totalPages = computed(() => Math.max(1, Math.ceil(dialogHistory.value.length / PAGE_SIZE)))
  const currentPageHistory = computed(() => {
    const start = (currentPage.value - 1) * PAGE_SIZE
    return dialogHistory.value.slice(start, start + PAGE_SIZE)
  })

  const lineSeqs = computed<Map<number, number>>(() => {
    const map = new Map<number, number>()
    let seq = 0
    dialogHistory.value.forEach((msg, absIndex) => {
      if (!msg.content || msg.content.trim() === '') return
      if (msg.type === 'reply' && msg.senderRoleId != null) {
        map.set(absIndex, seq)
        seq += 1
      }
    })
    return map
  })

  const groupedHistory = computed<HistoryBlock[]>(() => {
    const blocks: HistoryBlock[] = []
    const pageStart = (currentPage.value - 1) * PAGE_SIZE
    for (const [pageIndex, msg] of currentPageHistory.value.entries()) {
      const absIndex = pageStart + pageIndex
      if (!msg.content || msg.content.trim() === '') continue
      const isNarration = NARRATION_NAMES.has(msg.displayName || '')
      const name = isNarration
        ? ''
        : msg.displayName ||
          (msg.type === 'message'
            ? gameStore.userName || gameStore.mainRole?.roleName || youLabel()
            : mysteryLabel())
      const segments =
        locale.value === 'ja' && msg.ttsText
          ? [{ type: 'dialogue' as const, text: msg.ttsText }]
          : parseHistorySegments(hkify(msg.content), hkify(msg.motionText), isNarration)
      const entry: HistoryLineEntry = {
        segments,
        audioFile: msg.audioFile,
        userMessageSeq: msg.userMessageSeq,
        thinking: msg.thinking,
        absIndex,
        lineSeq: lineSeqs.value.get(absIndex),
      }
      const last = blocks.length > 0 ? blocks[blocks.length - 1] : undefined
      if (last && last.displayName === name && last.isNarration === isNarration) {
        if (typeof entry.userMessageSeq === 'number' && last.userMessageSeq === undefined) {
          last.userMessageSeq = entry.userMessageSeq
        }
        if (entry.thinking) last.thinking = entry.thinking
        last.lines.push(entry)
      } else {
        blocks.push({
          displayName: name,
          isNarration,
          lines: [entry],
          userMessageSeq: entry.userMessageSeq,
          thinking: entry.thinking,
        })
      }
    }
    return blocks
  })

  function isThinkingExpanded(blockIdx: number) {
    return expandedThinking.value.has(blockIdx)
  }

  function toggleThinking(blockIdx: number) {
    const next = new Set(expandedThinking.value)
    if (next.has(blockIdx)) next.delete(blockIdx)
    else next.add(blockIdx)
    expandedThinking.value = next
  }

  function resetAfterRollback() {
    eventQueue.clear()
    eventQueue.resume()
    uiStore.showCharacterLine = ''
    uiStore.currentAvatarAudio = 'None'
    gameStore.thinkingLength = 0
  }

  async function handleBacktrack(messageSeq: number) {
    const confirmed = await dialogStore.confirm(
      t(labels.backtrackConfirm),
      t(labels.backtrackTitle),
    )
    if (!confirmed) return
    try {
      const lines = await invoke<any[]>('rollback_conversation', { messageSeq })
      const messages = convertInitLines(
        lines.map(
          (l: any): GameLineInit => ({
            content: l.content,
            attribute: l.attribute,
            sender_role_id: l.sender_role_id,
            display_name: l.display_name,
            original_emotion: l.original_emotion,
            predicted_emotion: l.predicted_emotion,
            action_content: l.action_content,
            audio_file: l.audio_file,
            perceived_role_ids: l.perceived_role_ids,
            user_message_seq: l.user_message_seq,
            thinking: l.thinking ?? null,
            tts_content: l.tts_content ?? null,
          }),
        ),
      )
      gameStore.setGameMessages(messages)
      resetAfterRollback()
    } catch (error: any) {
      await dialogStore.alert(
        t(labels.backtrackFailed, { error: typeof error === 'string' ? error : error.message }),
      )
    }
  }

  function voiceKey(entry: HistoryLineEntry): string | null {
    return entry.lineSeq === undefined ? null : String(entry.lineSeq)
  }

  function canGenerateVoice(entry: HistoryLineEntry) {
    return voiceKey(entry) !== null
  }

  function isGeneratingVoice(entry: HistoryLineEntry) {
    const key = voiceKey(entry)
    return key !== null && generatingVoiceKeys.value.has(key)
  }

  const playAudio = async (audioFile: string) => {
    if (!audioFile || !audioRef.value) return
    audioRef.value.src = await getVoiceAudio(audioFile)
    audioRef.value.volume = uiStore.characterVolume / 100
    await audioRef.value.play()
  }

  async function generateVoice(entry: HistoryLineEntry) {
    const key = voiceKey(entry)
    if (key === null || generatingVoiceKeys.value.has(key)) return
    generatingVoiceKeys.value.add(key)
    try {
      const fileName = await invoke<string>('generate_line_voice', { lineSeq: Number(key) })
      suppressAutoScroll = true
      const msg = gameStore.dialogHistory[entry.absIndex]
      if (msg) msg.audioFile = fileName
      await playAudio(fileName)
      suppressAutoScroll = false
    } catch (error: any) {
      await dialogStore.alert(
        t(labels.generateFailed, { error: typeof error === 'string' ? error : error.message }),
      )
    } finally {
      generatingVoiceKeys.value.delete(key)
    }
  }

  async function scrollToBottom() {
    await nextTick()
    if (contentRef.value) contentRef.value.scrollTop = contentRef.value.scrollHeight
  }

  onMounted(async () => {
    if (dialogHistory.value.length > 0) {
      currentPage.value = totalPages.value
      await scrollToBottom()
    }
  })

  watch([currentPage, groupedHistory], async () => {
    if (suppressAutoScroll) return
    if (currentPage.value === totalPages.value) await scrollToBottom()
  })

  watch(
    () => dialogHistory.value.length,
    () => {
      currentPage.value = totalPages.value
    },
  )

  watch(
    () => uiStore.characterVolume,
    (v) => {
      if (audioRef.value) audioRef.value.volume = v / 100
    },
  )

  return {
    audioRef,
    contentRef,
    currentPage,
    totalPages,
    dialogHistory,
    groupedHistory,
    isThinkingExpanded,
    toggleThinking,
    handleBacktrack,
    canGenerateVoice,
    isGeneratingVoice,
    generateVoice,
    playAudio,
    scrollToBottom,
    gameStore,
  }
}
