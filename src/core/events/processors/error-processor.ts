import type { IEventProcessor } from '../event-processor'
import type { ScriptErrorEvent } from '../../../types'
import { useGameStore } from '../../../stores/modules/game'
import { useUIStore } from '../../../stores/modules/ui/ui'

export default class ErrorProcessor implements IEventProcessor {
  canHandle(eventType: string): boolean {
    return eventType === 'error'
  }

  async processEvent(event: ScriptErrorEvent): Promise<void> {
    const gameStore = useGameStore()
    const uiStore = useUIStore()

    uiStore.showError({
      errorCode: event.error_code || 'default_error',
    })

    gameStore.currentStatus = 'input'
    gameStore.currentLine = ''
  }
}
