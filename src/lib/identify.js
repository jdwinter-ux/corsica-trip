import { supabase } from './supabase';

export async function identifyPhoto(photoId, storagePath, dayContext) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/identify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      photo_id: photoId,
      storage_path: storagePath,
      day_context: dayContext,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Identification failed' }));
    throw new Error(error.error || 'Identification failed');
  }

  return response.json();
}
