import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Subscribe to Postgres changes on a table via Supabase Realtime.
 *
 * @param {string} channelName  Unique channel name (include the day number etc. so
 *                              switching context tears down and rebuilds the channel).
 * @param {{ table: string, filter?: string }} config
 *        `filter` is a PostgREST-style string, e.g. `day_number=eq.3`.
 * @param {{ onInsert?: (row) => void, onUpdate?: (row) => void, onDelete?: (oldRow) => void }} handlers
 *
 * Handlers are kept in a ref so they always see the latest state without
 * forcing a re-subscribe. The channel is only rebuilt when channelName/table/filter change.
 */
export function useRealtime(channelName, { table, filter } = {}, handlers = {}) {
  const handlersRef = useRef(handlers);
  // Keep the ref current without re-subscribing; updating it in an effect (not
  // during render) keeps event callbacks pointed at the latest handlers.
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!table || !channelName) return;

    const base = { schema: 'public', table };
    if (filter) base.filter = filter;

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', ...base }, (payload) => {
        handlersRef.current.onInsert?.(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', ...base }, (payload) => {
        handlersRef.current.onUpdate?.(payload.new);
      })
      .on('postgres_changes', { event: 'DELETE', ...base }, (payload) => {
        handlersRef.current.onDelete?.(payload.old);
      })
      .subscribe((status) => {
        // Surface connection problems instead of failing silently. CLOSED is
        // expected on teardown, so only warn on the genuine error states.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime channel "${channelName}" status: ${status}`);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelName, table, filter]);
}
