<template>
  <div class="ml-auto flex min-w-0 items-baseline">
    <template v-if="!isMobile">
      <div
        class="custom-scroll overflow-x-auto"
        :class="narrow ? 'min-w-0 flex-1' : 'shrink-0'"
      >
        <div class="action-bar flex items-center whitespace-nowrap">
          <Button type="nav" icon="background" :title="$t('game.dialog.sceneSettings')" @click="$emit('scene')" />
          <Button type="nav" icon="history" :title="$t('game.dialog.history')" @click="$emit('history')" />
          <Button
            type="nav"
            icon="mic"
            :title="isRecording ? $t('game.dialog.recordingStop') : $t('game.dialog.voiceInput')"
            :class="{ 'animate-pulse text-red-500': isRecording }"
            @click="$emit('record')"
          />
          <div class="group relative inline-flex">
            <div
              v-if="hasScreenshot"
              class="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            >
              <img
                :src="'data:image/jpeg;base64,' + screenshotBase64"
                class="max-h-64 max-w-96 rounded-lg border-2 object-contain shadow-lg"
                style="border-color: var(--accent-color); background: #000"
              />
            </div>
            <Button
              type="nav"
              icon="camera"
              :title="hasScreenshot ? $t('game.dialog.screenshotRetake') : $t('game.dialog.screenshotAsk')"
              :style="hasScreenshot ? { color: 'var(--accent-color)' } : {}"
              @click="$emit('screenshot')"
              @contextmenu.prevent="$emit('clear-screenshot')"
            />
          </div>
          <Button type="nav" icon="close" :title="$t('game.dialog.closeDialog')" @click="$emit('close')" />
        </div>
      </div>
    </template>

    <div v-if="isMobile" class="flex items-baseline gap-1">
      <button
        class="mobile-toggle-btn"
        :class="{ 'is-open': showMobileMenu }"
        :title="$t('game.dialog.moreActions')"
        @click="$emit('update:showMobileMenu', !showMobileMenu)"
      >
        ▲
      </button>
      <Button type="nav" icon="close" :title="$t('game.dialog.closeDialog')" @click="$emit('close')" />
    </div>
  </div>

  <Transition name="mobile-menu">
    <div v-if="isMobile && showMobileMenu" class="mobile-menu-dropdown w-full basis-full">
      <div class="custom-scroll flex gap-1 overflow-x-auto pb-1 whitespace-nowrap">
        <Button type="nav" icon="background" :title="$t('game.dialog.sceneSettings')" @click="act('scene')" />
        <Button
          type="nav"
          icon="hand"
          :title="$t('game.dialog.touchMode')"
          @click="act('touch')"
          @contextmenu.prevent="$emit('exit-touch')"
        />
        <Button type="nav" icon="history" :title="$t('game.dialog.history')" @click="act('history')" />
        <Button
          type="nav"
          icon="mic"
          :title="isRecording ? $t('game.dialog.recordingStop') : $t('game.dialog.voiceInput')"
          :class="{ 'animate-pulse text-red-500': isRecording }"
          @click="act('record')"
        />
        <div class="group relative inline-flex">
          <Button
            type="nav"
            icon="camera"
            :title="hasScreenshot ? $t('game.dialog.screenshotRetake') : $t('game.dialog.screenshotAsk')"
            :style="hasScreenshot ? { color: 'var(--accent-color)' } : {}"
            @click="act('screenshot')"
            @contextmenu.prevent="act('clear-screenshot')"
          />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Button } from '../../base'

defineProps<{
  isMobile: boolean
  narrow: boolean
  showMobileMenu: boolean
  isRecording: boolean
  hasScreenshot: boolean
  screenshotBase64: string | null
}>()

const emit = defineEmits<{
  scene: []
  history: []
  record: []
  screenshot: []
  'clear-screenshot': []
  close: []
  touch: []
  'exit-touch': []
  'update:showMobileMenu': [value: boolean]
}>()

function act(name: 'scene' | 'history' | 'record' | 'screenshot' | 'clear-screenshot' | 'touch') {
  switch (name) {
    case 'scene':
      emit('scene')
      break
    case 'history':
      emit('history')
      break
    case 'record':
      emit('record')
      break
    case 'screenshot':
      emit('screenshot')
      break
    case 'clear-screenshot':
      emit('clear-screenshot')
      break
    case 'touch':
      emit('touch')
      break
  }
  emit('update:showMobileMenu', false)
}
</script>

<style scoped>
.action-bar {
  padding: 2px 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.mobile-toggle-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 8px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  min-width: 38px;
}
.mobile-toggle-btn.is-open {
  transform: rotate(180deg);
  background: rgba(255, 255, 255, 0.18);
  color: var(--accent-color, #6eb4ff);
}
.mobile-menu-dropdown {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 4px 4px;
  margin-top: 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 14, 39, 0.5);
  border-radius: 0 0 8px 8px;
}
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.15s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
}
.custom-scroll {
  scrollbar-width: thin;
}
.custom-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
</style>
