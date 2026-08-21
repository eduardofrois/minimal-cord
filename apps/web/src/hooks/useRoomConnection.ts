import type { ChatMessage, Participant, ServerMessage } from '@minimal-cord/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRoomSocketUrl, connectRoomSocket, type ConnectRoomSocket, type RoomSocket } from '../lib/wsClient';

type UseRoomConnectionOptions = {
  roomId: string;
  displayName: string;
  connect?: ConnectRoomSocket;
};

export type RoomConnectionState = {
  participantId?: string;
  participants: Participant[];
  chatMessages: ChatMessage[];
  error?: string;
  socket?: RoomSocket;
  sendChat(text: string): void;
};

export function useRoomConnection({ roomId, displayName, connect = connectRoomSocket }: UseRoomConnectionOptions): RoomConnectionState {
  const [participantId, setParticipantId] = useState<string>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string>();
  const [socket, setSocket] = useState<RoomSocket>();
  const socketRef = useRef<RoomSocket>();

  const wsUrl = useMemo(() => buildRoomSocketUrl(window.location), []);

  useEffect(() => {
    function handleMessage(message: ServerMessage) {
      switch (message.type) {
        case 'room:joined':
          setParticipantId(message.participantId);
          setParticipants(message.participants);
          setChatMessages(message.chatMessages);
          setError(undefined);
          return;
        case 'participant:joined':
          setParticipants((current) =>
            current.some((participant) => participant.id === message.participant.id) ? current : [...current, message.participant]
          );
          return;
        case 'participant:left':
          setParticipants((current) => current.filter((participant) => participant.id !== message.participantId));
          return;
        case 'chat:message':
          setChatMessages((current) => [...current, message.message]);
          return;
        case 'room:not-found':
          setError('Sala não encontrada.');
          return;
        case 'room:full':
          setError(`Sala cheia (limite de ${message.limit} participantes).`);
          return;
        case 'error':
          setError(message.message);
          return;
        default:
      }
    }

    const nextSocket = connect(wsUrl, handleMessage);
    socketRef.current = nextSocket;
    setSocket(nextSocket);
    nextSocket.send({ type: 'room:join', roomId, displayName });

    return () => {
      socketRef.current = undefined;
      setSocket(undefined);
      setParticipantId(undefined);
      setParticipants([]);
      setChatMessages([]);
      nextSocket.close();
    };
  }, [connect, displayName, roomId, wsUrl]);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.send({ type: 'chat:send', text });
  }, []);

  return { participantId, participants, chatMessages, error, socket, sendChat };
}
