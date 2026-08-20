import { FormEvent, useState } from 'react';
import { readDisplayName, saveDisplayName } from '../lib/nameStorage';

type HomePageProps = {
  onCreateRoom(displayName: string): void;
  onJoinRoom(displayName: string, roomId: string): void;
};

export function HomePage({ onCreateRoom, onJoinRoom }: HomePageProps) {
  const [displayName, setDisplayName] = useState(() => readDisplayName());
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  function handleDisplayNameSubmit(action: () => void) {
    const trimmedDisplayName = displayName.trim();

    if (!trimmedDisplayName) {
      setError('Informe seu nome para continuar.');
      return;
    }

    saveDisplayName(trimmedDisplayName);
    setDisplayName(trimmedDisplayName);
    setError('');
    action();
  }

  function handleCreateRoom() {
    handleDisplayNameSubmit(() => onCreateRoom(displayName.trim()));
  }

  function handleJoinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    handleDisplayNameSubmit(() => onJoinRoom(displayName.trim(), roomId.trim()));
  }

  return (
    <main className="home-shell">
      <section className="home-card" aria-labelledby="home-title">
        <p className="eyebrow">minimal-cord</p>
        <h1 id="home-title">Chamada leve para amigos</h1>
        <p>
          Entre ou crie uma sala rápida para conversar sem complicação.
        </p>

        <div className="home-form">
          <div className="field">
            <label htmlFor="display-name">Nome</label>
            <input
              id="display-name"
              name="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="actions">
            <button type="button" onClick={handleCreateRoom}>
              Criar sala
            </button>
          </div>

          <form className="home-form" onSubmit={handleJoinRoom}>
            <div className="field">
              <label htmlFor="room-id">Código da sala</label>
              <input
                id="room-id"
                name="room-id"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="actions">
              <button type="submit">Entrar</button>
            </div>
          </form>

          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
