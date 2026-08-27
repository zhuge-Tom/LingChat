<template>
  <article class="w-full h-full flex flex-col min-h-0">
    <!-- 头部区域 -->
    <header class="mb-6 flex items-end justify-between border-b-2 pb-2 transition-colors shrink-0"
      :class="isDarkMode ? 'border-slate-700' : 'border-slate-100'">
      <div>
        <h2 class="text-xl font-black tracking-wide mb-1 transition-colors flex items-center gap-2"
          :class="isDarkMode ? 'text-slate-100' : 'text-slate-800'">
          <History class="w-5 h-5" />
          {{ $t('pet.history.title') }}
        </h2>
        <p class="text-xs font-medium transition-colors" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
          {{ $t('pet.history.desc') }}
        </p>
      </div>
      <span class="text-4xl font-bold italic select-none font-mono transition-colors"
        :class="isDarkMode ? 'text-slate-700' : 'text-sky-100'">
        02
      </span>
    </header>

    <!-- 主体内容区域 -->
    <div class="flex flex-col flex-1 min-h-0 gap-3">
      <!-- 空状态展示 -->
      <div v-if="dialogHistory.length === 0"
        class="flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all"
        :class="isDarkMode
          ? 'bg-slate-800/30 border-slate-700 text-slate-500'
          : 'bg-slate-50 border-slate-200 text-slate-400'
          ">
        <MessageSquare class="w-12 h-12 mb-4 opacity-50" />
        <p class="text-sm font-bold tracking-wider">
          {{ $t('pet.history.empty') }}
        </p>
      </div>

      <!-- 历史记录列表 -->
      <div v-else class="flex flex-col flex-1 min-h-0 gap-4">
        <!-- 滚动对话区域 -->
        <div
          ref="contentRef"
          class="flex-1 min-h-0 overflow-y-auto p-4 rounded-xl border shadow-sm transition-all scroll-smooth"
          :class="isDarkMode
            ? 'bg-slate-800/50 border-slate-700'
            : 'bg-white border-slate-200'
          "
          style="line-height: 1.9; font-size: 18px"
        >
          <template v-for="(item, i) in groupedHistory" :key="i">
            <div
              class="py-1"
              :class="{ 'border-t pt-3 mt-0': !item.isNarration && i > 0 }"
              :style="isDarkMode ? 'border-color: rgba(255,255,255,0.1)' : 'border-color: rgba(0,0,0,0.06)'"
            >
              <div v-if="!item.isNarration" class="mb-1 flex items-center justify-between">
                <span
                  class="text-[17px] font-semibold transition-colors"
                  :class="isDarkMode ? 'text-sky-400' : 'text-sky-600'"
                >
                  {{ item.displayName }}
                </span>
                <button
                  v-if="typeof item.userMessageSeq === 'number' && !gameStore.runningScript"
                  class="shrink-0 cursor-pointer rounded border border-white/10 bg-transparent px-2 py-0.5 text-xs text-white/40 transition-all duration-200 hover:border-red-400/50 hover:bg-red-500/20 hover:text-white"
                  :title="$t('pet.history.backtrackTitle')"
                  @click.stop="handleBacktrack(item.userMessageSeq!)"
                >
                  {{ $t('pet.history.backtrack') }}
                </button>
              </div>
              <div v-if="item.thinking" class="mb-1">
                <button
                  class="inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-all duration-200"
                  :class="isDarkMode
                    ? 'border-sky-400/25 bg-sky-400/10 text-sky-200/70 hover:border-sky-400/50 hover:text-sky-100'
                    : 'border-sky-200 bg-sky-50 text-sky-500/80 hover:border-sky-300 hover:text-sky-600'"
                  @click.stop="toggleThinking(i)"
                >
                  <span>{{ isThinkingExpanded(i) ? '▼' : '▶' }}</span>
                  <span>{{ $t('pet.history.thinking', { count: item.thinking.length }) }}</span>
                </button>
                <div
                  v-if="isThinkingExpanded(i)"
                  class="mt-1.5 max-h-64 overflow-y-auto rounded-2xl border px-4 py-3 text-[15px] leading-normal whitespace-pre-wrap scrollbar-thin"
                  :class="isDarkMode
                    ? 'border-sky-400/15 bg-sky-400/5 text-white/55'
                    : 'border-sky-100 bg-sky-50/70 text-slate-500'"
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
                    'italic': seg.type === 'action' || item.isNarration,
                  }"
                  :style="{
                    color: seg.type === 'action'
                      ? (isDarkMode ? '#c8d0dc' : '#64748b')
                      : item.isNarration
                        ? (isDarkMode ? '#b8c0cc' : '#475569')
                        : (isDarkMode ? '#e8e8e8' : '#1e293b'),
                    fontSize: '18px',
                    lineHeight: '1.9',
                  }"
                >
                  <span v-if="seg.type === 'action'">{{ seg.text }}</span>
                  <span v-else-if="item.isNarration">{{ seg.text }}</span>
                  <span v-else>{{ '「' + seg.text + '」' }}</span>
                  <button
                    v-if="seg.type !== 'action' && entry.audioFile"
                    class="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded border-0 transition-all duration-200"
                    :class="isDarkMode
                      ? 'bg-[rgba(121,217,255,0.15)] text-sky-400 hover:bg-[rgba(121,217,255,0.35)] hover:text-white'
                      : 'bg-sky-100 text-sky-600 hover:bg-sky-200 hover:text-sky-800'"
                    :title="$t('pet.history.playVoice')"
                    @click="playAudio(entry.audioFile)"
                  >
                    <Volume2 :size="16" />
                  </button>
                  <button
                    v-if="seg.type !== 'action' && !entry.audioFile && canGenerateVoice(entry)"
                    class="mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded border-0 transition-all duration-200 disabled:cursor-wait disabled:opacity-50"
                    :class="isDarkMode
                      ? 'bg-[rgba(121,217,255,0.1)] text-white/40 hover:bg-[rgba(121,217,255,0.35)] hover:text-white'
                      : 'bg-sky-50 text-sky-500 hover:bg-sky-200 hover:text-sky-800'"
                    :title="$t('pet.history.generateVoice')"
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

        <!-- 分页控制器 -->
        <div v-if="totalPages > 1" class="flex items-center justify-between px-1 shrink-0">
          <button
            class="px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isDarkMode
              ? 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600 hover:text-sky-400'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500'
            "
            :disabled="currentPage === 1"
            @click="currentPage--"
          >
            <ChevronLeft class="w-4 h-4" /> {{ $t('pet.history.prevPage') }}
          </button>

          <span
            class="text-xs font-bold tracking-widest font-mono transition-colors"
            :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'"
          >
            {{ $t('pet.history.pageInfo', { current: currentPage, total: totalPages }) }}
          </span>

          <button
            class="px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1 border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            :class="isDarkMode
              ? 'bg-slate-800/50 text-slate-300 border-slate-700 hover:bg-slate-700 hover:border-slate-600 hover:text-sky-400'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-500'
            "
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            {{ $t('pet.history.nextPage') }}
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <audio ref="audioRef"></audio>
  </article>
</template>

<script setup lang="ts">
import {
  History,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Volume2,
  AudioLines,
  LoaderCircle,
} from 'lucide-vue-next'
import { useDialogHistory } from '@/composables/useDialogHistory'

defineProps<{
  isDarkMode: boolean
}>()

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
  gameStore,
} = useDialogHistory({
  you: 'pet.history.you',
  mysteryVoice: 'pet.history.mysteryVoice',
  backtrackConfirm: 'pet.history.backtrackConfirmMessage',
  backtrackTitle: 'pet.history.backtrackConfirmTitle',
  backtrackFailed: 'pet.history.backtrackFailed',
  generateFailed: 'pet.history.generateVoiceFailed',
})
</script>
