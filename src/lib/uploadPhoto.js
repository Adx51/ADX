import { api } from './api'

export async function uploadPhoto(file, folder) {
  if (!file) return null
  const formData = new FormData()
  formData.append('photo', file)
  formData.append('folder', folder)
  const { url } = await api.upload('/photos', formData)
  return url
}

// No-op pour l'API locale (les photos sont écrasées par multer)
export async function deletePhoto() {}
