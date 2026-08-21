import { useCallback, useEffect, useRef, useState } from 'react';

export type LocalMediaState = {
  micStream?: MediaStream;
  cameraStream?: MediaStream;
  screenStreams: MediaStream[];
  error?: string;
  toggleMic(): Promise<void>;
  toggleCamera(): Promise<void>;
  startScreenShare(): Promise<void>;
  stopScreenShare(stream: MediaStream): void;
};

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function useLocalMedia(): LocalMediaState {
  const [micStream, setMicStream] = useState<MediaStream>();
  const [cameraStream, setCameraStream] = useState<MediaStream>();
  const [screenStreams, setScreenStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string>();

  const activeStreams = useRef<Set<MediaStream>>(new Set());

  useEffect(
    () => () => {
      for (const stream of activeStreams.current) stopStream(stream);
      activeStreams.current.clear();
    },
    []
  );

  const track = useCallback((stream: MediaStream) => {
    activeStreams.current.add(stream);
    return stream;
  }, []);

  const release = useCallback((stream: MediaStream) => {
    activeStreams.current.delete(stream);
    stopStream(stream);
  }, []);

  const toggleMic = useCallback(async () => {
    if (micStream) {
      release(micStream);
      setMicStream(undefined);
      return;
    }

    try {
      setMicStream(track(await navigator.mediaDevices.getUserMedia({ audio: true, video: false })));
      setError(undefined);
    } catch {
      setError('Não foi possível acessar o microfone. Verifique a permissão do navegador e tente de novo.');
    }
  }, [micStream, release, track]);

  const toggleCamera = useCallback(async () => {
    if (cameraStream) {
      release(cameraStream);
      setCameraStream(undefined);
      return;
    }

    try {
      setCameraStream(track(await navigator.mediaDevices.getUserMedia({ audio: false, video: true })));
      setError(undefined);
    } catch {
      setError('Não foi possível acessar a câmera. Verifique a permissão do navegador e tente de novo.');
    }
  }, [cameraStream, release, track]);

  const stopScreenShare = useCallback(
    (stream: MediaStream) => {
      release(stream);
      setScreenStreams((current) => current.filter((item) => item !== stream));
    },
    [release]
  );

  const startScreenShare = useCallback(async () => {
    try {
      const stream = track(await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false }));

      // O navegador tem o próprio botão de parar compartilhamento.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopScreenShare(stream));

      setScreenStreams((current) => [...current, stream]);
      setError(undefined);
    } catch {
      setError('Não foi possível compartilhar a tela. Verifique a permissão do navegador e tente de novo.');
    }
  }, [stopScreenShare, track]);

  return { micStream, cameraStream, screenStreams, error, toggleMic, toggleCamera, startScreenShare, stopScreenShare };
}
