import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalMedia } from './useLocalMedia';

function createFakeStream(kind: 'audio' | 'video') {
  const track = { id: `${kind}-track`, kind, stop: vi.fn(), addEventListener: vi.fn() };

  return {
    stream: {
      id: `${kind}-stream`,
      getTracks: () => [track],
      getAudioTracks: () => (kind === 'audio' ? [track] : []),
      getVideoTracks: () => (kind === 'video' ? [track] : [])
    } as unknown as MediaStream,
    track
  };
}

function stubMediaDevices(overrides: Partial<MediaDevices>) {
  vi.stubGlobal('navigator', { ...navigator, mediaDevices: overrides });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useLocalMedia', () => {
  it('captures and releases the microphone', async () => {
    const { stream, track } = createFakeStream('audio');
    stubMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) } as Partial<MediaDevices>);

    const { result } = renderHook(() => useLocalMedia());

    await act(async () => {
      await result.current.toggleMic();
    });
    expect(result.current.micStream).toBe(stream);

    await act(async () => {
      await result.current.toggleMic();
    });
    expect(result.current.micStream).toBeUndefined();
    expect(track.stop).toHaveBeenCalled();
  });

  it('reports a retry-friendly error when the camera is denied', async () => {
    stubMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) } as Partial<MediaDevices>);

    const { result } = renderHook(() => useLocalMedia());

    await act(async () => {
      await result.current.toggleCamera();
    });

    expect(result.current.cameraStream).toBeUndefined();
    expect(result.current.error).toMatch(/câmera/i);
  });

  it('keeps several screen shares at the same time', async () => {
    const first = createFakeStream('video');
    const second = createFakeStream('video');
    second.stream = { ...second.stream, id: 'video-stream-2' } as MediaStream;

    stubMediaDevices({
      getDisplayMedia: vi.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream)
    } as Partial<MediaDevices>);

    const { result } = renderHook(() => useLocalMedia());

    await act(async () => {
      await result.current.startScreenShare();
    });
    await act(async () => {
      await result.current.startScreenShare();
    });

    expect(result.current.screenStreams).toHaveLength(2);

    act(() => {
      result.current.stopScreenShare(first.stream);
    });

    expect(result.current.screenStreams).toEqual([second.stream]);
    expect(first.track.stop).toHaveBeenCalled();
  });
});
