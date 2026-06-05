import { useState, useEffect, useRef } from 'react';
import { sendChatMessage, fetchChatHistory, uploadChatAttachment, mergeMessage } from '../lib/chat';
import { useRealtime } from '../lib/useRealtime';
import { useOnReconnect } from '../lib/useOnReconnect';
import { PHOTO_ONLY_PLACEHOLDER } from '../lib/chatConstants';
import { THEME } from '../config/theme';

// Public URL for a chat attachment (the chat-attachments bucket is public-read).
// Encode the path so unusual filename-derived characters can't break the URL.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const attachmentUrl = (att) =>
  `${supabaseUrl}/storage/v1/object/public/chat-attachments/${encodeURIComponent(att.storage_path)}`;
const isImageAttachment = (att) => att?.type?.startsWith('image/') && att?.storage_path;

function truncateEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email.slice(0, 10) + (email.length > 10 ? '...' : '');
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (local.length <= 6) return email;
  return `${local.slice(0, 6)}...@${domain}`;
}

export default function ChatTab({ userEmail }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Live updates: messages from other travelers (and our own, once persisted)
  useRealtime('chat', { table: 'trip_chat' }, {
    onInsert: (row) => setMessages(prev => mergeMessage(prev, row)),
  });

  // After a reconnect, merge fresh history to recover any messages missed while
  // offline — no loading flash, and optimistic/local messages are preserved.
  useOnReconnect(async () => {
    try {
      const history = await fetchChatHistory();
      setMessages(prev => history.reduce((acc, row) => mergeMessage(acc, row), prev));
    } catch (e) {
      console.debug('Chat reconnect refetch failed:', e?.message);
    }
  });

  async function loadChatHistory() {
    setLoading(true);
    setLoadError(null);
    try {
      const history = await fetchChatHistory();
      setMessages(history);
    } catch (err) {
      console.error('Failed to load chat history:', err);
      setLoadError('Failed to load conversation. Check your connection.');
    }
    setLoading(false);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function handleSend() {
    if (!input.trim() && attachments.length === 0) return;
    if (sending) return;

    const messageText = input.trim();
    const messageAttachments = attachments.length > 0 ? attachments : null;
    // What we display/store for this message (photo-only sends show a placeholder)
    const displayContent = messageText || (messageAttachments ? PHOTO_ONLY_PLACEHOLDER : '');

    // Optimistic update - add user message immediately.
    // Random suffix avoids id collisions when two messages are sent in the
    // same millisecond (Date.now() alone is not unique enough for a React key).
    const optimisticUserMsg = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'user',
      author_email: userEmail,
      content: displayContent,
      attachments: messageAttachments,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticUserMsg]);
    setInput('');
    setAttachments([]);
    setSending(true);

    try {
      const result = await sendChatMessage(messageText, messageAttachments);

      // Add Léa's response (merge-deduped: the Realtime INSERT for this same
      // row may have already arrived before this response resolved)
      const assistantMsg = {
        id: result.message_id || `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant',
        author_email: null,
        content: result.response,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => mergeMessage(prev, assistantMsg));
    } catch (err) {
      console.error('Failed to send message:', err);
      // Flag the optimistic message for retry. A Realtime INSERT may have already
      // reconciled it to its persisted id (the server stores the user row before
      // calling Claude), so fall back to matching the most recent message with the
      // same content/author rather than only the temp id.
      setMessages(prev => {
        let idx = prev.findIndex(m => m.id === optimisticUserMsg.id);
        if (idx === -1) {
          for (let i = prev.length - 1; i >= 0; i--) {
            const m = prev[i];
            if (m.role === 'user' && m.content === displayContent && m.author_email === userEmail && !m._error) {
              idx = i;
              break;
            }
          }
        }
        if (idx === -1) return prev;
        return prev.map((m, i) =>
          i === idx ? { ...m, _error: true, _errorMessage: err.message } : m
        );
      });
    }

    setSending(false);
  }

  async function handleRetry(failedMsg) {
    // Remove the failed message
    setMessages(prev => prev.filter(m => m.id !== failedMsg.id));
    // Restore input and attachments
    setInput(failedMsg.content);
    if (failedMsg.attachments) {
      setAttachments(failedMsg.attachments);
    }
  }

  async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Limit total attachments per message
    const MAX_ATTACHMENTS = 5;
    if (attachments.length >= MAX_ATTACHMENTS) {
      alert(`Maximum ${MAX_ATTACHMENTS} attachments per message`);
      e.target.value = '';
      return;
    }

    const remainingSlots = MAX_ATTACHMENTS - attachments.length;
    const filesToProcess = files.slice(0, remainingSlots);

    if (files.length > remainingSlots) {
      alert(`Only adding ${remainingSlots} of ${files.length} files (max ${MAX_ATTACHMENTS} per message)`);
    }

    setUploadingAttachment(true);

    for (const file of filesToProcess) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown'];
      if (!validTypes.includes(file.type)) {
        alert(`File type not supported: ${file.type}`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File too large: ${file.name} (max 10MB)`);
        continue;
      }

      try {
        const attachment = await uploadChatAttachment(file);
        setAttachments(prev => [...prev, attachment]);
      } catch (err) {
        console.error('Failed to upload attachment:', err);
        alert(`Failed to upload: ${file.name}`);
      }
    }

    setUploadingAttachment(false);
    e.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 380px)', minHeight: '400px' }}>
      {/* Header */}
      <div style={{
        padding: '0.8rem 1rem',
        borderBottom: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
        marginBottom: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.3rem' }}>🇫🇷</span>
          <div>
            <div style={{ fontSize: '0.95rem', color: THEME.cream, fontWeight: 600 }}>
              Chat with Léa
            </div>
            <div style={{ fontSize: '0.7rem', color: THEME.blueMuted }}>
              Your local Corsica &amp; Côte d'Azur guide
            </div>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.5rem 0.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem',
      }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: THEME.blueMuted, fontSize: '0.9rem' }}>
            Loading conversation...
          </div>
        ) : loadError ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <div style={{ color: THEME.errorStrong, fontSize: '0.9rem', marginBottom: '0.8rem' }}>
              {loadError}
            </div>
            <button
              onClick={loadChatHistory}
              style={{
                padding: '0.5rem 1rem',
                background: THEME.rgba(THEME.base.goldDeep, 0.2),
                border: `1px solid ${THEME.rgba(THEME.base.goldDeep, 0.4)}`,
                borderRadius: '6px',
                color: THEME.gold,
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Try Again
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            background: THEME.rgba(THEME.base.goldDeep, 0.08),
            borderLeft: `3px solid ${THEME.gold}`,
            borderRadius: '0 10px 10px 0',
            padding: '1rem 1.2rem',
            maxWidth: '85%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🇫🇷</span>
              <span style={{ fontSize: '0.75rem', color: THEME.gold, fontWeight: 600 }}>Léa</span>
            </div>
            <div style={{ fontSize: '0.9rem', color: THEME.sand, lineHeight: 1.6 }}>
              Bonghjornu! I'm Léa, your local guide to Corsica and the Côte d'Azur.
              I know the hidden calas, the best socca and charcuterie, and which village tables the locals love.
              Ask me anything about your trip — I'm here to help make it unforgettable!
              <em style={{ color: THEME.blue }}> Bon viaghju!</em> (Have a great voyage!)
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'assistant' ? (
                // Léa's message
                <div style={{
                  background: THEME.rgba(THEME.base.goldDeep, 0.08),
                  borderLeft: `3px solid ${THEME.gold}`,
                  borderRadius: '0 10px 10px 0',
                  padding: '0.8rem 1rem',
                  maxWidth: '85%',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>🇫🇷</span>
                    <span style={{ fontSize: '0.7rem', color: THEME.gold, fontWeight: 600 }}>Léa</span>
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: THEME.sand,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                // User message
                <div style={{
                  background: msg._error ? THEME.rgba(THEME.base.red, 0.15) : THEME.rgba(THEME.base.blueGray, 0.12),
                  borderRadius: '10px 10px 0 10px',
                  padding: '0.8rem 1rem',
                  maxWidth: '85%',
                }}>
                  <div style={{ fontSize: '0.65rem', color: THEME.blueMuted, marginBottom: '0.3rem' }}>
                    {truncateEmail(msg.author_email)}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    color: msg._error ? THEME.error : THEME.bluePale,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {msg.content}
                    {msg._error && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: THEME.errorStrong }}>
                          {msg._errorMessage || 'Failed to send'}
                        </span>
                        <button
                          onClick={() => handleRetry(msg)}
                          style={{
                            marginTop: '0.3rem',
                            padding: '0.2rem 0.5rem',
                            background: THEME.rgba(THEME.base.red, 0.2),
                            border: `1px solid ${THEME.rgba(THEME.base.red, 0.4)}`,
                            borderRadius: '4px',
                            color: THEME.error,
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {msg.attachments.map((att, i) => (
                        isImageAttachment(att) ? (
                          <img
                            key={i}
                            src={attachmentUrl(att)}
                            alt={att.name}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            style={{
                              maxWidth: '100%', maxHeight: 220, objectFit: 'contain',
                              borderRadius: '8px', display: 'block',
                              border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
                            }}
                          />
                        ) : (
                          <span key={i} style={{
                            padding: '0.2rem 0.5rem',
                            background: THEME.rgba(THEME.base.white, 0.1),
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            color: THEME.blue,
                          }}>
                            📄 {att.name}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {/* Typing indicator */}
        {sending && (
          <div style={{
            background: THEME.rgba(THEME.base.goldDeep, 0.08),
            borderLeft: `3px solid ${THEME.gold}`,
            borderRadius: '0 10px 10px 0',
            padding: '0.8rem 1rem',
            maxWidth: '85%',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem' }}>🇫🇷</span>
              <span style={{ fontSize: '0.7rem', color: THEME.gold, fontWeight: 600 }}>Léa</span>
              <span style={{ fontSize: '0.75rem', color: THEME.blueMuted, marginLeft: '0.3rem' }}>
                is typing<span className="typing-dots">...</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div style={{
          padding: '0.5rem 1rem',
          borderTop: `1px solid ${THEME.rgba(THEME.base.gold, 0.1)}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
        }}>
          {attachments.map((att, i) => (
            isImageAttachment(att) ? (
              <div key={i} style={{ position: 'relative' }}>
                <img src={attachmentUrl(att)} alt={att.name}
                  onError={(e) => { e.currentTarget.style.opacity = 0.3; }}
                  style={{
                    width: 56, height: 56, objectFit: 'cover', borderRadius: '6px',
                    border: `1px solid ${THEME.rgba(THEME.base.gold, 0.3)}`, display: 'block',
                  }} />
                <button
                  onClick={() => removeAttachment(i)}
                  title="Remove"
                  style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 18, height: 18, borderRadius: '50%', border: 'none',
                    background: THEME.errorStrong, color: THEME.bgDeep,
                    fontSize: '0.7rem', lineHeight: 1, cursor: 'pointer',
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <span key={i} style={{
                padding: '0.3rem 0.6rem',
                background: THEME.rgba(THEME.base.goldDeep, 0.15),
                borderRadius: '6px',
                fontSize: '0.75rem',
                color: THEME.gold,
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                📄 {att.name}
                <button
                  onClick={() => removeAttachment(i)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: THEME.goldDark,
                    cursor: 'pointer',
                    padding: '0 0.2rem',
                    fontSize: '0.8rem',
                  }}
                >
                  ×
                </button>
              </span>
            )
          ))}
        </div>
      )}

      {/* Input area */}
      <div style={{
        padding: '0.8rem',
        borderTop: `1px solid ${THEME.rgba(THEME.base.gold, 0.15)}`,
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-end',
      }}>
        {/* Attachment button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingAttachment || sending}
          style={{
            background: THEME.rgba(THEME.base.white, 0.05),
            border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
            borderRadius: '8px',
            padding: '0.6rem',
            color: uploadingAttachment ? THEME.blueDim : THEME.blue,
            cursor: uploadingAttachment || sending ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
          title="Attach file"
        >
          {uploadingAttachment ? '⏳' : '📎'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/markdown"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Text input */}
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Léa anything..."
          rows={1}
          disabled={sending}
          style={{
            flex: 1,
            background: THEME.rgba(THEME.base.white, 0.05),
            border: `1px solid ${THEME.rgba(THEME.base.gold, 0.2)}`,
            borderRadius: '10px',
            padding: '0.7rem 1rem',
            color: THEME.parchment,
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            resize: 'none',
            outline: 'none',
            minHeight: '40px',
            maxHeight: '120px',
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sending || (!input.trim() && attachments.length === 0)}
          style={{
            background: sending || (!input.trim() && attachments.length === 0)
              ? THEME.rgba(THEME.base.goldDeep, 0.3)
              : `linear-gradient(135deg, ${THEME.gold}, ${THEME.goldLight})`,
            border: 'none',
            borderRadius: '8px',
            padding: '0.6rem 0.8rem',
            color: THEME.bgDeep,
            cursor: sending || (!input.trim() && attachments.length === 0) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
          }}
          title="Send message"
        >
          {sending ? '⏳' : '➤'}
        </button>
      </div>

      {/* Inline styles for typing animation */}
      <style>{`
        @keyframes typing {
          0%, 20% { opacity: 0.3; }
          50% { opacity: 1; }
          80%, 100% { opacity: 0.3; }
        }
        .typing-dots {
          animation: typing 1.4s infinite;
        }
      `}</style>
    </div>
  );
}
