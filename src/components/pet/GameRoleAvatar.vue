<template>
  <div
    class="relative flex items-center justify-center w-full h-full group"
    @click="handleAvatarClick"
  >
    <!-- 缩放与尺寸控制层 (无位移) -->
    <div class="relative w-full h-full">
      <!-- 1. 右上角信息铭牌 -->
      <div
        class="absolute top-1 -right-4 z-50 flex flex-col items-start pointer-events-none opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-400 ease-out"
      >
        <div
          class="bg-cyan-500 text-white text-[10px] font-black px-2 py-0.5 rounded-tl-md rounded-br-md italic shadow-sm tracking-wider"
        >
          {{ role.roleName }}
        </div>
        <div
          class="text-cyan-700 dark:text-cyan-300 text-xs font-bold tracking-widest pl-1 drop-shadow-sm uppercase"
        >
          {{ role.roleSubTitle }}
        </div>
      </div>

      <!-- 3. 常驻特效：现代科技感流光圆环 -->
      <div
        class="absolute inset-3 rounded-full border-[1.5px] border-cyan-400/20 animate-pulse-slow pointer-events-none"
      ></div>
      <!-- 流光扫边特效环 -->
      <div
        class="absolute -inset-1 rounded-full pointer-events-none sweep-glow-ring drop-shadow-[0_0_6px_rgba(34,211,238,0.4)]"
      ></div>

      <!-- 5. 核心头像框 -->
      <div
        class="relative w-full h-full rounded-full bg-white/10 dark:bg-black/10 backdrop-blur-md border-2 border-white/60 dark:border-white/20 shadow-[0_8px_32px_rgba(0,176,255,0.15)] overflow-hidden flex items-center justify-center transition-colors duration-300 z-10"
        data-tauri-drag-region
      >
        <!-- 下降效果的粒子系统 -->
        <BAParticles
          v-if="uiStore.currentBackgroundEffect === 'BA'"
          class="absolute inset-0 w-full h-full z-0 pointer-events-none"
          :particle-count="60"
          :speed="0.2"
        />

        <StarField
          v-if="uiStore.currentBackgroundEffect === 'StarField'"
          class="absolute inset-0 w-full h-full z-0 pointer-events-none"
        />

        <!-- 头像图片容器 -->
        <div
          :class="['w-full h-full z-10 rounded-full overflow-hidden', containerClasses]"
          @animationend="handleAnimationEnd"
        >
          <div class="w-full h-full origin-top" :style="avatarStyles">
            <ImageCrossFade
              ref="imageFadeRef"
              class="w-full h-full object-cover animate-breathing"
              :src="targetAvatarUrl"
              :style="imageStyles"
              position="center 0%"
              object-fit="cover"
            />
          </div>
        </div>

        <audio ref="bubbleAudio"></audio>
      </div>

      <!-- 6. 气泡表情（盒子放大到头像框 2.8 倍，见 constants/sprite.ts 的 PET_BUBBLE_BOX） -->
      <div
        :class="[
          'absolute z-73 bg-contain bg-no-repeat pointer-events-none transition-all duration-300 origin-bottom-left',
          bubbleClasses,
        ]"
        :style="{ ...bubbleStyles, ...PET_BUBBLE_BOX_STYLE }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRefs } from 'vue'
import BAParticles from './BAParticles.vue'
import ImageCrossFade from '@/components/ui/ImageAcrossFade.vue'
import StarField from '../game/standard/particles/StarField.vue'
import type { GameRole } from '@/stores/modules/game/state'
import { useUIStore } from '@/stores/modules/ui/ui'
import { PET_BUBBLE_BOX, type PetBubbleBox } from '@/constants/sprite'
import { useEmotionPlayback } from '@/composables/useEmotionPlayback'
import './avatar-animation.css'

const PET_BUBBLE_BOX_STYLE: PetBubbleBox = PET_BUBBLE_BOX

const props = defineProps<{ role: GameRole }>()
const { role } = toRefs(props)

const emit = defineEmits(['avatar-click'])
const bubbleAudio = ref<HTMLAudioElement | null>(null)
const imageFadeRef = ref<InstanceType<typeof ImageCrossFade> | null>(null)
const uiStore = useUIStore()

const {
  targetAvatarUrl,
  activeAnimationClass,
  isBubbleVisible,
  currentBubbleImageUrl,
  currentBubbleClass,
  handleAnimationEnd,
} = useEmotionPlayback({
  role,
  imageFadeRef,
  bubbleAudio,
  restartBubble: false,
})

const containerClasses = computed(() => ({
  [activeAnimationClass.value]: true,
  'opacity-100': role.value.show,
  'opacity-0': !role.value.show,
}))

const avatarStyles = computed(() => ({
  transform: `scale(${role.value.scaleP}) translate(${role.value.offsetXP}px, ${role.value.offsetYP}px)`,
}))

const imageStyles = computed(() => ({
  top: `-10px`,
}))

const bubbleClasses = computed(() => ({
  'opacity-100': isBubbleVisible.value,
  'opacity-0': !isBubbleVisible.value,
  'bubble-pop': isBubbleVisible.value,
  [currentBubbleClass.value]: isBubbleVisible.value && currentBubbleClass.value,
}))

const bubbleStyles = computed(() => ({
  backgroundImage: `url(${currentBubbleImageUrl.value})`,
}))

const handleAvatarClick = () => emit('avatar-click')
</script>

<style scoped>
.animate-breathing {
  animation: breathing 4s ease-in-out infinite alternate;
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes breathing {
  0% {
    transform: scale(1);
  }
  100% {
    transform: scale(1.02);
  }
}

@keyframes pulse-slow {
  0%,
  100% {
    opacity: 0.3;
  }
  50% {
    opacity: 1;
  }
}

.sweep-glow-ring {
  background: conic-gradient(
    from 0deg,
    transparent 40%,
    rgba(34, 211, 238, 0.1) 70%,
    rgba(34, 211, 238, 0.8) 100%
  );
  -webkit-mask: radial-gradient(transparent 68%, #000 69%);
  mask: radial-gradient(transparent 68%, #000 69%);
  animation: spin 4s linear infinite;
}

[data-tauri-drag-region] {
  -webkit-app-region: drag;
}
</style>
