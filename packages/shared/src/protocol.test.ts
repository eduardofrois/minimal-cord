import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_PARTICIPANTS, isClientMessage } from './index.js';

describe('shared protocol', () => {
  it('exports the default room participant limit', () => {
    expect(DEFAULT_MAX_PARTICIPANTS).toBe(20);
  });

  it('recognizes valid client messages', () => {
    expect(isClientMessage({ type: 'room:create', displayName: 'Ana' })).toBe(true);
    expect(isClientMessage({ type: 'chat:send', text: 'oi' })).toBe(true);
    expect(isClientMessage({ type: 'media:consume', transportId: 't1', producerId: 'p1', rtpCapabilities: {} })).toBe(true);
  });

  it('rejects invalid client messages', () => {
    expect(isClientMessage(null)).toBe(false);
    expect(isClientMessage({ type: 'chat:send', text: '' })).toBe(false);
    expect(isClientMessage({ type: 'media:consume', producerId: 'p1', rtpCapabilities: {} })).toBe(false);
    expect(isClientMessage({ type: 'unknown' })).toBe(false);
  });
});
