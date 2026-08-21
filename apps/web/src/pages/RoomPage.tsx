import { ChatPanel } from '../components/ChatPanel';
import { ParticipantList } from '../components/ParticipantList';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { readDisplayName } from '../lib/nameStorage';

type RoomPageProps = {
  roomId: string;
};

export function RoomPage({ roomId }: RoomPageProps) {
  const displayName = readDisplayName() || 'Convidado';
  const room = useRoomConnection({ roomId, displayName });

  if (room.error) {
    return (
      <main className="room-shell">
        <section className="home-card">
          <p className="form-error">{room.error}</p>
          <div className="actions">
            <button type="button" onClick={() => { window.location.href = '/'; }}>
              Voltar para o início
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="room-layout">
      <section className="stage">
        <h1>Sala {roomId}</h1>
        <p>{room.participantId ? 'Conectado' : 'Entrando...'}</p>
      </section>
      <ParticipantList participants={room.participants} currentParticipantId={room.participantId} />
      <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
    </main>
  );
}
