import { supabase } from './supabase'

export async function uploadPhoto(file, folder) {
  if (!file) return null
  const ext = file.name.split('.').pop()
  const { data: { user } } = await supabase.auth.getUser()
  const path = `${user.id}/${folder}/${Date.now()}.${ext}`

  const { error } = await supabase.storage.from('photos').upload(path, file, {
    cacheControl: '3600',
    upsert: false
  })
  if (error) throw error

  const { data } = supabase.storage.from('photos').getPublicUrl(path)
  return data.publicUrl
}

export async function deletePhoto(url) {
  if (!url) return
  try {
    const path = url.split('/photos/')[1]
    if (path) await supabase.storage.from('photos').remove([path])
  } catch {
    // ignore delete errors
  }
}
