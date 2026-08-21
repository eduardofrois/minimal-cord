import { useEffect, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';
import { buildRoomPath, getRoomIdFromPath } from './lib/roomLink';

type Route = { name: 'home' } | { name: 'room'; roomId?: string };

function routeFromPath(pathname: string): Route {
  const roomId = getRoomIdFromPath(pathname);
  return roomId ? { name: 'room', roomId } : { name: 'home' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));

  useEffect(() => {
    function handlePopState() {
      setRoute(routeFromPath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (route.name === 'room') {
    // Sem roomId a RoomPage cria a sala e assume o link que o servidor devolver.
    return <RoomPage key={route.roomId ?? 'new'} roomId={route.roomId} />;
  }

  return (
    <HomePage
      onCreateRoom={() => setRoute({ name: 'room' })}
      onJoinRoom={(_, targetRoomId) => {
        window.history.pushState(null, '', buildRoomPath(targetRoomId));
        setRoute({ name: 'room', roomId: targetRoomId });
      }}
    />
  );
}
