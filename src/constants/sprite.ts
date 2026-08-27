/**
 * 立绘渲染基础放大系数。
 *
 * 原版 LingChat（v0.3.0 web 版）的立绘在屏幕中的占比明显更大
 * （galgame.css 中对人物图应用了 scale(1.9)）。Tauri 版改用逐角色
 * settings.yml 的 scale 配置后默认偏小，这里统一乘以该系数恢复
 * 「适中」的观感。触摸区域热区（TouchAreas）必须使用同一系数，
 * 才能与大尺寸立绘保持对齐。
 *
 * 窄屏（宽高比 < 1，手机竖屏）下原有适配逻辑会主动缩小立绘高度，
 * 此时不再叠加放大，避免破坏移动端布局。
 */
export const SPRITE_BASE_SCALE = 1.2

/** 按当前视口宽高比计算应使用的立绘放大系数 */
export const spriteBoostFor = (aspectRatio: number): number =>
  aspectRatio >= 1 ? SPRITE_BASE_SCALE : 1

/**
 * 桌宠模式情绪气泡的盒子尺寸与锚点（相对头像框的百分比）。
 * 素材已裁成内容精灵，贴在头像左上角即可。
 */
export const PET_BUBBLE_BOX = {
  width: '90%',
  height: '90%',
  left: '-28%',
  top: '-38%',
} as const

export type PetBubbleBox = Record<string, string>
