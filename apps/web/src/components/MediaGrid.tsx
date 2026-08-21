import { useEffect, useMemo, useRef } from 'react';
import type { RemoteTrack } from '../lib/mediaClient';

type VideoTileProps = {
  stream: MediaStream;
  label: string;
  featured?: boolean;
  muted?: boolean;
};

function VideoTile({ stream, label, featured, muted }: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream;
    // Alguns navegadores rejeitam o autoplay; o clique nos controles destrava.
    void element.play().catch(() => undefined);

    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return (
    <article className={featured ? 'media-tile featured' : 'media-tile'}>
      <video ref={ref} autoPlay playsInline muted={muted} />
      <span>{label}</span>
    </article>
  );
}

function AudioSink({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = stream;
    void element.play().catch(() => undefined);

    return () => {
      element.srcObject = null;
    };
  }, [stream]);

  return <audio ref={ref} autoPlay />;
}

type MediaGridProps = {
  cameraStream?: MediaStream;
  screenStreams: MediaStream[];
  remoteTracks: RemoteTrack[];
  displayNameFor(participantId: string): string;
};

export function MediaGrid({ cameraStream, screenStreams, remoteTracks, displayNameFor }: MediaGridProps) {
  // Um MediaStream estável por producer evita remontar o <video> a cada mudança.
  const streamCache = useRef(new Map<string, MediaStream>());
  const remote = useMemo(() => {
    const live = new Set(remoteTracks.map((item) => item.producerId));
    for (const producerId of streamCache.current.keys()) {
      if (!live.has(producerId)) streamCache.current.delete(producerId);
    }

    return remoteTracks.map((item) => {
      let stream = streamCache.current.get(item.producerId);
      if (!stream) {
        stream = new MediaStream([item.track]);
        streamCache.current.set(item.producerId, stream);
      }

      return { ...item, stream };
    });
  }, [remoteTracks]);

  const remoteVideos = remote.filter((item) => item.kind === 'video');
  const remoteAudios = remote.filter((item) => item.kind === 'audio');
  const isEmpty = !cameraStream && screenStreams.length === 0 && remoteVideos.length === 0;

  return (
    <div className="media-grid">
      {cameraStream ? <VideoTile stream={cameraStream} label="Sua câmera" muted /> : null}

      {screenStreams.map((stream) => (
        <VideoTile key={stream.id} stream={stream} label="Sua tela" featured muted />
      ))}

      {remoteVideos.map((item) => (
        <VideoTile
          key={item.producerId}
          stream={item.stream}
          label={`${displayNameFor(item.participantId)} — ${item.source === 'screen' ? 'tela' : 'câmera'}`}
          featured={item.source === 'screen'}
        />
      ))}

      {remoteAudios.map((item) => (
        <AudioSink key={item.producerId} stream={item.stream} />
      ))}

      {isEmpty ? <p className="media-empty">Nenhuma câmera ou tela ativa.</p> : null}
    </div>
  );
}
