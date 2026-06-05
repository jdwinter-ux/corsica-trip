import { useEffect, useRef } from 'react';

/**
 * Run `callback` whenever the browser regains connectivity (window 'online').
 *
 * Realtime (websocket) auto-reconnects, but Postgres changes that happened while
 * the socket was down are NOT replayed — so components should refetch on
 * reconnect to recover missed notes/photos/messages.
 *
 * The callback is kept in a ref so the listener is attached once and always
 * calls the latest closure.
 */
export function useOnReconnect(callback) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });

  useEffect(() => {
    const handler = () => ref.current?.();
    window.addEventListener('online', handler);
    return () => window.removeEventListener('online', handler);
  }, []);
}
