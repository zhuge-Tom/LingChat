export interface HistorySegment {
  type: 'dialogue' | 'action'
  text: string
}

const ACTION_RE = /（[^）]*）/

function stripTrailPeriod(text: string): string {
  return text.replace(/[。]+$/, '')
}

export function parseHistorySegments(
  raw: string,
  actionPart: string | undefined,
  isNarration: boolean,
): HistorySegment[] {
  const segments: HistorySegment[] = []
  let remaining = raw
  let match: RegExpExecArray | null

  while ((match = ACTION_RE.exec(remaining)) !== null) {
    if (match.index > 0) {
      let text = remaining.substring(0, match.index)
      if (!isNarration) text = stripTrailPeriod(text)
      if (text.trim()) segments.push({ type: 'dialogue', text })
    }
    remaining = remaining.substring(match.index + match[0].length)
  }

  remaining = remaining.trim()
  if (remaining) {
    if (!isNarration) remaining = stripTrailPeriod(remaining)
    segments.push({ type: 'dialogue', text: remaining })
  }
  if (actionPart) segments.push({ type: 'action', text: actionPart })
  return segments
}
