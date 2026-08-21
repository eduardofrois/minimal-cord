import { useEffect, useMemo, useRef } from 'react';
import { Maximize2 } from 'lucide-react';
import type { RemoteTrack } from '../lib/mediaClient';

type VideoSource = 'camera' | 'screen';

type MediaTile = {
  id: string;
  stream: MediaStream;
  label: string;
  muted?: boolean;
  source: VideoSource;
  priority: number;
};

type VideoTileProps = {
  tile: MediaTile;
  variant?: 'featured' | 'strip';
};

function VideoTile({ tile, variant = 'strip' }: VideoTileProps) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.srcObject = tile.stream;
    // Alguns navegadores rejeitam o autoplay; o clique nos controles destrava.
    void element.play().catch(() => undefined);

    return () => {
      element.srcObject = null;
    };
  }, [tile.stream]);

  function handleFullscreen() {
    const element = ref.current;
    if (!element?.requestFullscreen) return;

    void element.requestFullscreen().catch(() => undefined);
  }

  const isFeatured = variant === 'featured';
  const canFullscreen = isFeatured && tile.source === 'screen';

  return (
    <article className={isFeatured ? 'media-tile media-tile-featured' : 'media-tile media-tile-strip'}>
      <video ref={ref} autoPlay playsInline muted={tile.muted} />
      <span>{tile.label}</span>
      {canFullscreen ? (
        <button type="button" className="tile-action" aria-label="Tela cheia do compartilhamento" title="Tela cheia" onClick={handleFullscreen}>
          <Maximize2 aria-hidden="true" size={18} strokeWidth={2.2} />
        </button>
      ) : null}
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

  const remoteAudios = remote.filter((item) => item.kind === 'audio');
  const tiles = useMemo<MediaTile[]>(() => {
    const remoteVideos = remote.filter((item) => item.kind === 'video');
    const localScreenTiles = screenStreams.map((stream, index) => ({
      id: `local-screen-${stream.id}`,
      stream,
      label: index === 0 ? 'Sua tela' : `Sua tela ${index + 1}`,
      muted: true,
      source: 'screen' as const,
      priority: 100 - index
    }));

    const localCameraTile = cameraStream
      ? [
          {
            id: `local-camera-${cameraStream.id}`,
            stream: cameraStream,
            label: 'Sua câmera',
            muted: true,
            source: 'camera' as const,
            priority: 60
          }
        ]
      : [];

    const remoteVideoTiles = remoteVideos.map((item, index) => {
      const isScreen = item.source === 'screen';

      return {
        id: item.producerId,
        stream: item.stream,
        label: `${displayNameFor(item.participantId)} - ${isScreen ? 'tela' : 'câmera'}`,
        source: isScreen ? ('screen' as const) : ('camera' as const),
        priority: isScreen ? 80 - index : 40 - index
      };
    });

    return [...localScreenTiles, ...remoteVideoTiles, ...localCameraTile];
  }, [cameraStream, displayNameFor, remote, screenStreams]);

  const featuredTile = tiles.reduce<MediaTile | undefined>((selected, tile) => (!selected || tile.priority > selected.priority ? tile : selected), undefined);
  const stripTiles = featuredTile ? tiles.filter((tile) => tile.id !== featuredTile.id) : [];

  return (
    <div className="media-stage">
      <div className="featured-stage">
        {featuredTile ? <VideoTile tile={featuredTile} variant="featured" /> : <p className="media-empty">Nenhuma câmera ou tela ativa.</p>}
      </div>

      {stripTiles.length > 0 ? (
        <div className="media-strip" aria-label="Participantes com vídeo">
          {stripTiles.map((tile) => (
            <VideoTile key={tile.id} tile={tile} />
          ))}
        </div>
      ) : null}

      {remoteAudios.map((item) => (
        <AudioSink key={item.producerId} stream={item.stream} />
      ))}
    </div>
  );
}
