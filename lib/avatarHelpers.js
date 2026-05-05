import { supabase } from './supabaseClient';

const PLACEHOLDER_COLORS = [
  '#2196F3',
  '#4ECDC4',
  '#FF9800',
  '#9C27B0',
  '#E91E63',
  '#00BCD4',
  '#8BC34A',
  '#FF6B6B',
];

/**
 * Deterministic background color for avatar placeholder (user id, name, or any seed string).
 */
export function avatarPlaceholderColor(seed) {
  const s = seed != null && String(seed).length ? String(seed) : 'anon';
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = s.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PLACEHOLDER_COLORS.length;
  return PLACEHOLDER_COLORS[idx];
}

/**
 * Up to two initials from a display name or email.
 */
export function initialsFromName(name) {
  if (!name || !String(name).trim()) return '?';
  const trimmed = String(name).trim();
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return trimmed.charAt(0).toUpperCase();
}

/**
 * Public URL for an object key in the `avatars` bucket.
 */
export function getAvatarPublicUrl(storagePath) {
  if (!storagePath) return '';
  const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  return data?.publicUrl || '';
}
