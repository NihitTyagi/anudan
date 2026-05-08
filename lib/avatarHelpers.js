import { supabase } from './supabaseClient';

/**
 * Public URL for an object key in the `avatars` bucket.
 */
export function getAvatarPublicUrl(storagePath) {
  if (!storagePath) return '';
  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  return data?.publicUrl || '';
}
