import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { buildRoomPath, getRoomIdFromPath } from './lib/roomLink';

export default function App() {
  const roomId = getRoomIdFromPath(window.location.pathname);

  if (roomId) {
    return <RoomPage roomId={roomId} />;
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
