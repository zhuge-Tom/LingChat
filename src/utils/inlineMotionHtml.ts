function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[ch] || ch,
  )
}

export function buildInlineMotionHtml(text: string, isNarration: boolean): string {
  if (isNarration) {
    return `<span class="narration-inline">${escapeHtml(text)}</span>`
  }
  const newlineIndex = text.indexOf('\n')
  if (newlineIndex > 0) {
    const dialogue = escapeHtml(text.substring(0, newlineIndex))
    const motion = escapeHtml(text.substring(newlineIndex + 1))
    return `<span style="color:#fff">${dialogue}</span><br><span class="motion-text-gray">${motion}</span>`
  }
  if (newlineIndex === 0) {
    return `<br><span class="motion-text-gray">${escapeHtml(text.substring(1))}</span>`
  }
  return `<span style="color:#fff">${escapeHtml(text)}</span>`
}
