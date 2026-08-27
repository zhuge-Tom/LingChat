<template>
  <section :class="['menu-item', size]">
    <div class="menu-item-head w-full flex items-center pb-2.5 mb-4 space-x-2">
      <slot name="header"></slot>
      <div class="title-wrapper">
        <h4>{{ displayTitle }}</h4>
      </div>
    </div>
    <div class="content">
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  size: {
    type: String as () => 'small' | 'large',
    default: 'large',
    validator: (value: string) => ['small', 'large'].includes(value),
  },
})

const displayTitle = computed(() => props.title || t('ui.menuItem.defaultTitle'))
</script>

<style scoped>
section {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06));
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 16px 18px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
}

section.large {
  width: 100%;
}

section.small {
  width: calc(50% - 12.5px); /* 减去一半的margin */
}

.menu-item-head {
  border-bottom: 1px solid rgba(255, 255, 255, 0.16);
}
.title-wrapper h4 {
  margin: 0;
  color: #fff;
  font-weight: 650;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.35);
}

.content {
  width: 100%;
}

/* 响应式设计 - 在小屏幕上让small菜单项变为全宽 */
@media (max-width: 768px) {
  section.small {
    width: 100%;
    max-width: 900px;
  }
}
</style>
