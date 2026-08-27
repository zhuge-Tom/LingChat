/**
 * Pinia 持久化插件
 * 自动将 store 状态同步到 localStorage
 */
import type { PiniaPluginContext } from 'pinia'

// 持久化配置
interface PersistOptions {
  key?: string // 自定义存储键名
  exclude?: string[] // 排除的字段
}

// 扩展 Pinia 的 DefineStoreOptions
declare module 'pinia' {
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: boolean | PersistOptions
  }
}

// 深度合并：target 的默认值 + source 的持久化值
export function deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

export function persist({ store, options }: PiniaPluginContext) {
  // 只有明确配置了 persist: true 的 store 才持久化
  if (!options.persist) return

  const persistOptions = typeof options.persist === 'object' ? options.persist : {}
  const storageKey = persistOptions.key || `lingchat-${store.$id}`
  const excludeFields = persistOptions.exclude || []

  const heavyKey = `${storageKey}:dialogBg`

  const saved = localStorage.getItem(storageKey)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      const filtered = excludeFields.length
        ? Object.fromEntries(Object.entries(parsed).filter(([key]) => !excludeFields.includes(key)))
        : parsed
      const merged = deepMerge(JSON.parse(JSON.stringify(store.$state)), filtered)
      const heavy = localStorage.getItem(heavyKey)
      if (heavy && merged.display && typeof merged.display === 'object') {
        merged.display.dialogBackgroundImage = heavy
      }
      store.$patch(merged)
    } catch (e) {
      console.error(`恢复设置失败 (${storageKey}):`, e)
    }
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null
  store.$subscribe((_mutation, state) => {
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      try {
        const toSave: Record<string, any> = excludeFields.length
          ? Object.fromEntries(Object.entries(state).filter(([key]) => !excludeFields.includes(key)))
          : JSON.parse(JSON.stringify(state))
        const bg = toSave.display?.dialogBackgroundImage
        if (typeof bg === 'string' && bg.startsWith('data:')) {
          localStorage.setItem(heavyKey, bg)
          toSave.display.dialogBackgroundImage = ''
        } else {
          localStorage.removeItem(heavyKey)
        }
        localStorage.setItem(storageKey, JSON.stringify(toSave))
      } catch (e) {
        console.error(`保存设置失败 (${storageKey}):`, e)
      }
    }, 200)
  })
}
