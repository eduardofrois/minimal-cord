import { HomePage } from './pages/HomePage';
import { buildRoomPath, getRoomIdFromPath } from './lib/roomLink';

export default function App() {
  const roomId = getRoomIdFromPath(window.location.pathname);

  if (roomId) {
    return (
      <main className="room-shell">
        <p>Entrando na sala {roomId}...</p>
      </main>
    );
  }

  return (
    <HomePage
      onCreateRoom={() => undefined}
      onJoinRoom={(_, targetRoomId) => {
        window.location.href = buildRoomPath(targetRoomId);
      }}
    />
  );
}
