<template>
  <MenuPage>
    <MenuItem :title="$t('settings.history.title')">
      <template #header>
        <History :size="20" />
      </template>
      <div class="flex flex-col h-full max-h-[75vh] min-h-0">
        <div
          v-if="dialogHistory.length === 0"
          class="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/15 bg-white/5 p-8 text-white/50"
        >
          <History class="mb-4 h-12 w-12 opacity-50" />
          <p class="text-sm font-bold tracking-wider">
            {{ $t('settings.history.empty') }}
          </p>
        </div>

        <div v-else class="flex flex-1 flex-col min-h-0">
          <div
            ref="contentRef"
            class="flex-1 min-h-0 overflow-y-auto px-1.5 py-3.5 scrollbar-thin [scrollbar-color:var(--accent-color,#79d9ff)_transparent] scroll-smooth"
            style="line-height: 1.9; font-size: 18px"
          >
            <template v-for="(item, i) in groupedHistory" :key="i">
              <div
                class="py-1"
                :class="{ 'border-t border-white/10 pt-3 mt-0': !item.isNarration && i > 0 }"
              >
                <div v-if="!item.isNarration" class="mb-1 flex items-center justify-between">
                  <span class="text-[17px] font-semibold text-[#79d9ff]">
                    {{ item.displayName }}
                  </span>
                  <button
                    v-if="typeof item.userMessageSeq === 'number' && !gameStore.runningScript"
                    class="shrink-0 cursor-pointer rounded border border-white/10 bg-transparent px-2 py-0.5 text-xs text-white/40 transition-all duration-200 hover:border-red-400/50 hover:bg-red-500/20 hover:text-white"
                    :title="$t('settings.history.backtrackTip')"
                    @click.stop="handleBacktrack(item.userMessageSeq!)"
                  >
                    {{ $t('settings.history.backtrack') }}
                  </button>
                </div>
                <div v-if="item.thinking" class="mb-1">
                  <button
                    class="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[rgba(121,217,255,0.25)] bg-[rgba(121,217,255,0.08)] px-2.5 py-0.5 text-xs text-[#a8d8f0]/70 transition-all duration-200 hover:border-[rgba(121,217,255,0.5)] hover:text-[#c9e7ff]"
                    @click.stop="toggleThinking(i)"
                  >
                    <span>{{ isThinkingExpanded(i) ? '▼' : '▶' }}</span>
                    <span>{{ $t('settings.history.thinking', { count: item.thinking.length }) }}</span>
                  </button>
                  <div
                    v-if="isThinkingExpanded(i)"
                    class="mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-[rgba(121,217,255,0.15)] bg-[rgba(121,217,255,0.05)] px-4 py-3 text-[15px] leading-normal whitespace-pre-wrap text-white/55 scrollbar-thin"
                  >
                    {{ item.thinking }}
                  </div>
                </div>
                <template v-for="(entry, j) in item.lines" :key="j">
                  <div
                    v-for="(seg, k) in entry.segments"
                    :key="k"
                    class="flex items-start gap-1.5 py-0.5 whitespace-pre-wrap wrap-break-word"
                    :class="{
                      'text-[#c8d0dc] italic': seg.type === 'action',
                      'text-[#b8c0cc] italic': item.isNarration && seg.type !== 'action',
                      'text-[#e8e8e8]': seg.type !== 'action' && !item.isNarration,
                    }"
                    style="font-size: 18px; line-height: 1.9"
                  >
                    <span v-if="seg.type === 'action'" class="text-[#c8d0dc]">{{ seg.text }}</span>
                    <span v-else-if="item.isNarration">{{ seg.text }}</span>
                    <span v-else>{{ '「' + seg.text + '」' }}</span>
                    <button
                      v-if="seg.type !== 'action' && entry.audioFile"
                      class="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-[rgba(121,217,255,0.15)] text-(--accent-color,#79d9ff) transition-all duration-200 hover:bg-[rgba(121,217,255,0.35)] hover:text-white"
                      :title="$t('settings.history.playVoice')"
                      @click="playAudio(entry.audioFile)"
                    >
                      <Volume2 :size="16" />
                    </button>
                    <button
                      v-if="seg.type !== 'action' && !entry.audioFile && canGenerateVoice(entry)"
                      class="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-[rgba(121,217,255,0.1)] text-white/35 transition-all duration-200 hover:bg-[rgba(121,217,255,0.35)] hover:text-white disabled:cursor-wait disabled:opacity-50"
                      :title="$t('settings.history.generateVoice')"
                      :disabled="isGeneratingVoice(entry)"
                      @click="generateVoice(entry)"
                    >
                      <LoaderCircle v-if="isGeneratingVoice(entry)" :size="16" class="animate-spin" />
                      <AudioLines v-else :size="16" />
                    </button>
                  </div>
                </template>
              </div>
            </template>
          </div>

          <div
            v-if="totalPages > 1"
            class="mt-auto flex w-full shrink-0 items-center justify-between px-3 py-2"
          >
            <button
              class="cursor-pointer rounded-lg border-0 bg-[#e9ecef] px-4 py-1.5 text-sm font-medium text-[#495057] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:bg-(--accent-color,#79d9ff) hover:not-disabled:text-white hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_4px_10px_rgba(121,217,255,0.4)]"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              {{ $t('settings.shared.prevPage') }}
            </button>
            <span class="text-base font-medium text-gray-100">
              {{ $t('settings.shared.pageOfTotal', { current: currentPage, total: totalPages }) }}
            </span>
            <button
              class="cursor-pointer rounded-lg border-0 bg-[#e9ecef] px-4 py-1.5 text-sm font-medium text-[#495057] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 hover:not-disabled:bg-(--accent-color,#79d9ff) hover:not-disabled:text-white hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-[0_4px_10px_rgba(121,217,255,0.4)]"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              {{ $t('settings.shared.nextPage') }}
            </button>
          </div>

          <audio ref="audioRef"></audio>
        </div>
      </div>
    </MenuItem>
  </MenuPage>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useUIStore } from '@/stores/modules/ui/ui'
import { MenuPage, MenuItem } from '../../ui'
import { History, Volume2, AudioLines, LoaderCircle } from 'lucide-vue-next'
import { useDialogHistory } from '@/composables/useDialogHistory'

const uiStore = useUIStore()
const {
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
} = useDialogHistory({
  you: 'settings.history.you',
  mysteryVoice: 'settings.history.mysteryVoice',
  backtrackConfirm: 'settings.history.backtrackConfirm',
  backtrackTitle: 'settings.history.backtrackConfirmTitle',
  backtrackFailed: 'settings.history.backtrackFailed',
  generateFailed: 'settings.history.generateVoiceFailed',
})

watch([() => uiStore.currentSettingsTab, () => uiStore.showSettings], async () => {
  if (uiStore.currentSettingsTab === 'history' && uiStore.showSettings) {
    await scrollToBottom()
  }
})
</script>
