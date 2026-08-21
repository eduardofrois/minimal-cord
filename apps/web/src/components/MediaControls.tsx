type MediaControlsProps = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenCount: number;
  onToggleMic(): void;
  onToggleCamera(): void;
  onStartScreenShare(): void;
};

export function MediaControls({ micEnabled, cameraEnabled, screenCount, onToggleMic, onToggleCamera, onStartScreenShare }: MediaControlsProps) {
  return (
    <div className="media-controls">
      <button type="button" aria-pressed={micEnabled} onClick={onToggleMic}>
        {micEnabled ? 'Desligar microfone' : 'Ligar microfone'}
      </button>
      <button type="button" aria-pressed={cameraEnabled} onClick={onToggleCamera}>
        {cameraEnabled ? 'Desligar câmera' : 'Ligar câmera'}
      </button>
      <button type="button" onClick={onStartScreenShare}>
        Compartilhar tela
      </button>
      <span className="media-hint">
        {screenCount === 0 ? 'Nenhuma tela sua' : `${screenCount} tela(s) sua(s)`}
      </span>
    </div>
  );
}
