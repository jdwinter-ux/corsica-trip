import { supabase } from './supabase';

export { mergeMessage } from './chatMerge';

export async function sendChatMessage(message, attachments = null) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Please log in to chat with Léa');
  }

  // Client-side validation — allow an attachment-only message (no text)
  const trimmed = message?.trim() || '';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!trimmed && !hasAttachments) {
    throw new Error('Message cannot be empty');
  }
  if (trimmed.length > 4000) {
    throw new Error('Message too long (max 4000 characters)');
  }

  // Add timeout for slow connections
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        message: trimmed,
        attachments,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed (${response.status})`);
    }

    return response.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  }
}

export async function fetchChatHistory(limit = 50) {
  // Add timeout for slow connections
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Loading chat history timed out')), 15000)
  );

  const fetchPromise = supabase
    .from('trip_chat')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);

  try {
    const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

    if (error) {
      console.error('Error fetching chat history:', error);
      throw error;
    }

    return data || [];
  } catch (err) {
    console.error('Error fetching chat history:', err);
    throw err;
  }
}

export async function uploadChatAttachment(file) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('chat-attachments')
    .upload(fileName, file);

  if (uploadError) {
    throw new Error('Failed to upload attachment');
  }

  return {
    name: file.name,
    storage_path: fileName,
    type: file.type,
  };
}
