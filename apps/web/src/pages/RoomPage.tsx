import { useCallback } from 'react';
import { ChatPanel } from '../components/ChatPanel';
import { MediaControls } from '../components/MediaControls';
import { MediaGrid } from '../components/MediaGrid';
import { ParticipantList } from '../components/ParticipantList';
import { useLocalMedia } from '../hooks/useLocalMedia';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { useRoomMedia } from '../hooks/useRoomMedia';
import { readDisplayName } from '../lib/nameStorage';
import { buildRoomPath } from '../lib/roomLink';

type RoomPageProps = {
  /** Sem valor, a página cria uma sala nova e adota o id devolvido. */
  roomId?: string;
};

export function RoomPage({ roomId }: RoomPageProps) {
  const displayName = readDisplayName() || 'Convidado';
  const room = useRoomConnection({ roomId, displayName });
  const localMedia = useLocalMedia();
  const roomMedia = useRoomMedia({
    socket: room.socket,
    participantId: room.participantId,
    subscribe: room.subscribe,
    micStream: localMedia.micStream,
    cameraStream: localMedia.cameraStream,
    screenStreams: localMedia.screenStreams
  });

  const displayNameFor = useCallback(
    (participantId: string) => room.participants.find((participant) => participant.id === participantId)?.displayName ?? 'Participante',
    [room.participants]
  );

  if (room.error) {
    return (
      <main className="room-shell">
        <section className="home-card">
          <p className="form-error">{room.error}</p>
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/';
              }}
            >
              Voltar para o início
            </button>
          </div>
        </section>
      </main>
    );
  }

  const roomUrl = room.roomId ? `${window.location.origin}${buildRoomPath(room.roomId)}` : undefined;
  const mediaError = localMedia.error ?? roomMedia.error;

  return (
    <main className="room-layout">
      <section className="stage">
        <header className="stage-header">
          <div>
            <h1>{room.roomId ? `Sala ${room.roomId}` : 'Criando sala...'}</h1>
            <p>{room.participantId ? (roomMedia.ready ? 'Conectado' : 'Preparando mídia...') : 'Entrando...'}</p>
          </div>
          <button type="button" disabled={!roomUrl} onClick={() => roomUrl && void navigator.clipboard?.writeText(roomUrl)}>
            Copiar link
          </button>
        </header>

        {mediaError ? <p className="form-error">{mediaError}</p> : null}

        <MediaGrid
          cameraStream={localMedia.cameraStream}
          screenStreams={localMedia.screenStreams}
          remoteTracks={roomMedia.remoteTracks}
          displayNameFor={displayNameFor}
        />

        <MediaControls
          micEnabled={Boolean(localMedia.micStream)}
          cameraEnabled={Boolean(localMedia.cameraStream)}
          screenCount={localMedia.screenStreams.length}
          onToggleMic={() => void localMedia.toggleMic()}
          onToggleCamera={() => void localMedia.toggleCamera()}
          onStartScreenShare={() => void localMedia.startScreenShare()}
        />
      </section>

      <ParticipantList participants={room.participants} currentParticipantId={room.participantId} />
      <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
    </main>
  );
}
