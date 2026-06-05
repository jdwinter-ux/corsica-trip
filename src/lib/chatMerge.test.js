import { describe, it, expect } from 'vitest';
import { mergeMessage } from './chatMerge';

const at = (s) => `2025-06-12T10:00:0${s}.000Z`;

describe('mergeMessage', () => {
  it('appends a new message to an empty list', () => {
    const row = { id: 'a', role: 'user', content: 'hi', created_at: at(1) };
    expect(mergeMessage([], row)).toEqual([row]);
  });

  it('is a no-op when a message with the same id already exists', () => {
    const existing = [{ id: 'a', role: 'user', content: 'hi', created_at: at(1) }];
    const result = mergeMessage(existing, { id: 'a', role: 'user', content: 'changed', created_at: at(2) });
    expect(result).toBe(existing); // same reference — unchanged
  });

  it('reconciles an optimistic temp- user message with its persisted row', () => {
    const optimistic = { id: 'temp-123', role: 'user', content: 'hello', author_email: 'a@x.com', created_at: at(1) };
    const persisted = { id: 'uuid-real', role: 'user', content: 'hello', author_email: 'a@x.com', created_at: at(1) };
    const result = mergeMessage([optimistic], persisted);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-real');
  });

  it('does NOT reconcile another traveler\'s identical-text message into our pending one', () => {
    // Unfiltered chat channel: B's persisted row reaches A while A's "ok" is still optimistic.
    const myPending = { id: 'temp-1', role: 'user', content: 'ok', author_email: 'me@x.com', created_at: at(1) };
    const theirRow = { id: 'uuid-b', role: 'user', content: 'ok', author_email: 'them@x.com', created_at: at(2) };
    const result = mergeMessage([myPending], theirRow);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toEqual(['temp-1', 'uuid-b']);
  });

  it('reconciles an assistant- placeholder by role + content', () => {
    const placeholder = { id: 'assistant-9', role: 'assistant', content: 'ciao', created_at: at(2) };
    const persisted = { id: 'uuid-asst', role: 'assistant', content: 'ciao', created_at: at(2) };
    const result = mergeMessage([placeholder], persisted);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('uuid-asst');
  });

  it('does not reconcile when content differs (appends instead)', () => {
    const optimistic = { id: 'temp-1', role: 'user', content: 'one', created_at: at(1) };
    const other = { id: 'uuid-2', role: 'user', content: 'two', created_at: at(2) };
    const result = mergeMessage([optimistic], other);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.id)).toEqual(['temp-1', 'uuid-2']);
  });

  it('does not reconcile a confirmed (non-placeholder) message', () => {
    const confirmed = { id: 'uuid-1', role: 'user', content: 'dup', created_at: at(1) };
    const incoming = { id: 'uuid-2', role: 'user', content: 'dup', created_at: at(2) };
    const result = mergeMessage([confirmed], incoming);
    expect(result).toHaveLength(2);
  });

  it('orders the result by created_at ascending', () => {
    const a = { id: 'a', role: 'user', content: 'first', created_at: at(1) };
    const c = { id: 'c', role: 'assistant', content: 'third', created_at: at(3) };
    const b = { id: 'b', role: 'user', content: 'second', created_at: at(2) };
    const result = mergeMessage([a, c], b);
    expect(result.map(m => m.id)).toEqual(['a', 'b', 'c']);
  });
});
