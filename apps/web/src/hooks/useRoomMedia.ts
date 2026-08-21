import type { PublishedTrack, ServerMessage } from '@minimal-cord/shared';
import { useEffect, useRef, useState } from 'react';
import { RoomMediaClient, type RemoteTrack } from '../lib/mediaClient';
import type { RoomSocket } from '../lib/wsClient';
import type { ServerMessageListener } from './useRoomConnection';

type UseRoomMediaOptions = {
  socket?: RoomSocket;
  participantId?: string;
  subscribe(listener: ServerMessageListener): () => void;
  micStream?: MediaStream;
  cameraStream?: MediaStream;
  screenStreams: MediaStream[];
};

export type RoomMediaState = {
  ready: boolean;
  remoteTracks: RemoteTrack[];
  error?: string;
};

type DesiredTrack = {
  track: MediaStreamTrack;
  source: PublishedTrack['source'];
};

function collectLocalTracks(micStream?: MediaStream, cameraStream?: MediaStream, screenStreams: MediaStream[] = []): DesiredTrack[] {
  const desired: DesiredTrack[] = [];

  const micTrack = micStream?.getAudioTracks()[0];
  if (micTrack) desired.push({ track: micTrack, source: 'mic' });

  const cameraTrack = cameraStream?.getVideoTracks()[0];
  if (cameraTrack) desired.push({ track: cameraTrack, source: 'camera' });

  for (const stream of screenStreams) {
    const screenTrack = stream.getVideoTracks()[0];
    if (screenTrack) desired.push({ track: screenTrack, source: 'screen' });
  }

  return desired;
}

/**
 * Drives the mediasoup send/recv transports for the current room: publishes the
 * local tracks and consumes every remote producer.
 */
export function useRoomMedia({ socket, participantId, subscribe, micStream, cameraStream, screenStreams }: UseRoomMediaOptions): RoomMediaState {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [remoteProducers, setRemoteProducers] = useState<PublishedTrack[]>([]);
  const [remoteTracks, setRemoteTracks] = useState<RemoteTrack[]>([]);

  const clientRef = useRef<RoomMediaClient>();
  const publishedRef = useRef(new Map<string, string>());
  const consumingRef = useRef(new Set<string>());

  useEffect(() => {
    if (!socket || !participantId) return;

    let cancelled = false;
    const client = new RoomMediaClient(socket);
    clientRef.current = client;

    const unsubscribe = subscribe((message: ServerMessage) => {
      client.handleMessage(message);

      if (message.type === 'media:new-producer') {
        if (message.producer.participantId === participantId) return;
        setRemoteProducers((current) =>
          current.some((producer) => producer.producerId === message.producer.producerId) ? current : [...current, message.producer]
        );
        return;
      }

      if (message.type === 'media:producer-closed') {
        setRemoteProducers((current) => current.filter((producer) => producer.producerId !== message.producerId));
        setRemoteTracks((current) => current.filter((remote) => remote.producerId !== message.producerId));
        consumingRef.current.delete(message.producerId);
        return;
      }

      if (message.type === 'participant:left') {
        setRemoteProducers((current) => current.filter((producer) => producer.participantId !== message.participantId));
        setRemoteTracks((current) => current.filter((remote) => remote.participantId !== message.participantId));
      }
    });

    void (async () => {
      try {
        await client.load();
        await client.openRecvTransport();
        await client.openSendTransport();

        const existing = await client.listRemoteProducers();
        if (cancelled) return;

        setRemoteProducers((current) => {
          const merged = new Map(current.map((producer) => [producer.producerId, producer]));
          for (const producer of existing) merged.set(producer.producerId, producer);
          return [...merged.values()];
        });
        setReady(true);
        setError(undefined);
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Falha ao iniciar a mídia da sala.');
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
      client.close();
      clientRef.current = undefined;
      publishedRef.current.clear();
      consumingRef.current.clear();
      setReady(false);
      setRemoteProducers([]);
      setRemoteTracks([]);
    };
  }, [participantId, socket, subscribe]);

  // Consome os producers remotos que ainda não têm track local.
  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !client) return;

    for (const producer of remoteProducers) {
      if (consumingRef.current.has(producer.producerId)) continue;
      consumingRef.current.add(producer.producerId);

      void client
        .consume(producer)
        .then((remote) => {
          setRemoteTracks((current) =>
            current.some((item) => item.producerId === remote.producerId) ? current : [...current, remote]
          );
        })
        .catch((cause: unknown) => {
          consumingRef.current.delete(producer.producerId);
          setError(cause instanceof Error ? cause.message : 'Falha ao receber a mídia de outro participante.');
        });
    }
  }, [ready, remoteProducers]);

  // Publica e despublica as tracks locais conforme os controles mudam.
  useEffect(() => {
    const client = clientRef.current;
    if (!ready || !client) return;

    const desired = collectLocalTracks(micStream, cameraStream, screenStreams);
    const desiredIds = new Set(desired.map((item) => item.track.id));

    for (const [trackId, producerId] of [...publishedRef.current.entries()]) {
      if (desiredIds.has(trackId)) continue;
      publishedRef.current.delete(trackId);
      client.unpublish(producerId);
    }

    for (const item of desired) {
      if (publishedRef.current.has(item.track.id)) continue;
      // Reserva a chave antes do await para não publicar a mesma track duas vezes.
      publishedRef.current.set(item.track.id, '');

      void client
        .publish(item.track, item.source)
        .then((producerId) => {
          if (publishedRef.current.has(item.track.id)) publishedRef.current.set(item.track.id, producerId);
          else client.unpublish(producerId);
        })
        .catch((cause: unknown) => {
          publishedRef.current.delete(item.track.id);
          setError(cause instanceof Error ? cause.message : 'Falha ao publicar sua mídia.');
        });
    }
  }, [cameraStream, micStream, ready, screenStreams]);

  return { ready, remoteTracks, error };
}
