import { invoke } from '@tauri-apps/api/core'
import type { BackgroundImageInfo } from '../../types'

export const getBackgroundImages = async (): Promise<BackgroundImageInfo[]> => {
  try {
    const data = await invoke('get_background_list')
    return data as BackgroundImageInfo[]
  } catch (error: any) {
    console.error(
      'Failed to get background list:',
      typeof error === 'string' ? error : error.message,
    )
    throw error
  }
}

export const getBackgroundImageById = async (_id: string): Promise<BackgroundImageInfo> => {
  throw new Error('getBackgroundImageById is no longer available')
}

export const uploadBackgroundImage = async (
  fileName: string,
  fileData: Uint8Array,
): Promise<BackgroundImageInfo[]> => {
  return invoke('upload_background_image', { fileName, fileData })
}

export const setCurrentBackground = async (_background: string): Promise<void> => {}

export const setCurrentBackgroundEffect = async (_effect: string): Promise<void> => {}

export const generateBackgroundImage = async (_prompt: string, _clientId: string): Promise<void> => {}

export const openBackgroundsFolder = async (): Promise<void> => {
  await invoke('open_backgrounds_folder')
}
