import type { ChatMessage } from '@minimal-cord/shared';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { MAX_CHAT_TEXT_LENGTH } from '@minimal-cord/shared';

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend(text: string): void;
};

export function ChatPanel({ messages, onSend }: ChatPanelProps) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = text.trim();
    if (!trimmed) return;

    onSend(trimmed);
    setText('');
  }

  return (
    <aside className="panel chat-panel" aria-labelledby="chat-title">
      <h2 id="chat-title">Chat</h2>
      <div className="chat-messages" ref={listRef}>
        {messages.map((message) => (
          <p key={message.id}>
            <strong>{message.displayName}:</strong> {message.text}
          </p>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          aria-label="Mensagem"
          value={text}
          maxLength={MAX_CHAT_TEXT_LENGTH}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
        />
        <button type="submit">Enviar</button>
      </form>
    </aside>
  );
}
