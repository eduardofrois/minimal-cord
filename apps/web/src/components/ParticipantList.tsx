import type { Participant } from '@minimal-cord/shared';

type ParticipantListProps = {
  participants: Participant[];
  currentParticipantId?: string;
};

export function ParticipantList({ participants, currentParticipantId }: ParticipantListProps) {
  return (
    <aside className="panel" aria-labelledby="participants-title">
      <h2 id="participants-title">Participantes ({participants.length})</h2>
      <ul className="participant-list">
        {participants.map((participant) => (
          <li key={participant.id}>
            {participant.displayName}
            {participant.id === currentParticipantId ? <span className="tag">você</span> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
