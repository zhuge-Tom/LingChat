import { ref, onUnmounted } from 'vue'

type SpeechRec = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onstart: (() => void) | null
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export function useSpeechRecognition(options: {
  lang?: string
  onFinal: (text: string) => void
  canStart: () => boolean
  onBlocked: () => Promise<void>
  onUnsupported: () => Promise<void>
}) {
  const isRecording = ref(false)
  const interimText = ref('')
  let recognition: SpeechRec | null = null

  const init = () => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRec }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition
    if (!Ctor) return null

    const rec = new Ctor()
    rec.lang = options.lang ?? 'zh-CN'
    rec.interimResults = true
    rec.maxAlternatives = 1
    rec.onstart = () => {
      isRecording.value = true
      interimText.value = ''
    }
    rec.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const piece = event.results[i][0].transcript
        if (event.results[i].isFinal) final += piece
        else interim += piece
      }
      if (interim) interimText.value = interim
      if (final) {
        interimText.value = ''
        options.onFinal(final)
      }
    }
    rec.onerror = (event) => {
      console.error('语音识别出错:', event.error)
      isRecording.value = false
      interimText.value = ''
    }
    rec.onend = () => {
      isRecording.value = false
      interimText.value = ''
    }
    recognition = rec
    return rec
  }

  const toggleRecording = async () => {
    if (!recognition) {
      await options.onUnsupported()
      return
    }
    if (isRecording.value) {
      recognition.stop()
      return
    }
    if (!options.canStart()) {
      await options.onBlocked()
      return
    }
    recognition.start()
  }

  const stop = () => {
    if (recognition && isRecording.value) recognition.stop()
  }

  onUnmounted(stop)

  return { isRecording, interimText, init, toggleRecording, stop }
}
