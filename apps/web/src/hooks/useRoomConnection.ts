import type { ChatMessage, Participant, ServerMessage } from '@minimal-cord/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildRoomPath } from '../lib/roomLink';
import { buildRoomSocketUrl, connectRoomSocket, type ConnectRoomSocket, type RoomSocket } from '../lib/wsClient';

type UseRoomConnectionOptions = {
  /** Sala a entrar. Sem valor, a conexão cria uma sala nova. */
  roomId?: string;
  displayName: string;
  connect?: ConnectRoomSocket;
};

export type ServerMessageListener = (message: ServerMessage) => void;

export type RoomConnectionState = {
  roomId?: string;
  participantId?: string;
  participants: Participant[];
  chatMessages: ChatMessage[];
  error?: string;
  socket?: RoomSocket;
  sendChat(text: string): void;
  /** Registers a listener for every server message. Returns the unsubscribe. */
  subscribe(listener: ServerMessageListener): () => void;
};

export function useRoomConnection({ roomId, displayName, connect = connectRoomSocket }: UseRoomConnectionOptions): RoomConnectionState {
  const [currentRoomId, setCurrentRoomId] = useState(roomId);
  const [participantId, setParticipantId] = useState<string>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string>();
  const [socket, setSocket] = useState<RoomSocket>();
  const socketRef = useRef<RoomSocket>();
  const listenersRef = useRef(new Set<ServerMessageListener>());

  const wsUrl = useMemo(() => buildRoomSocketUrl(window.location), []);

  useEffect(() => {
    function handleMessage(message: ServerMessage) {
      for (const listener of listenersRef.current) listener(message);

      switch (message.type) {
        case 'room:created':
          // A sala só existe enquanto o criador estiver conectado, então a mesma
          // conexão vira a sessão da sala em vez de reabrir a página.
          setCurrentRoomId(message.roomId);
          window.history.pushState(null, '', buildRoomPath(message.roomId));
          return;
        case 'room:joined':
          setCurrentRoomId(message.roomId);
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
    nextSocket.send(roomId ? { type: 'room:join', roomId, displayName } : { type: 'room:create', displayName });

    return () => {
      socketRef.current = undefined;
      setSocket(undefined);
      setParticipantId(undefined);
      setParticipants([]);
      setChatMessages([]);
      nextSocket.close();
    };
  }, [connect, displayName, roomId, wsUrl]);

  const subscribe = useCallback((listener: ServerMessageListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const sendChat = useCallback((text: string) => {
    socketRef.current?.send({ type: 'chat:send', text });
  }, []);

  return { roomId: currentRoomId, participantId, participants, chatMessages, error, socket, sendChat, subscribe };
}
