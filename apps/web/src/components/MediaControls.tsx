import type { LucideIcon } from 'lucide-react';
import { Mic, MicOff, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff } from 'lucide-react';

type MediaControlsProps = {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenCount: number;
  onToggleMic(): void;
  onToggleCamera(): void;
  onStartScreenShare(): void;
  onStopScreenShare(): void;
  onDisconnect(): void;
};

type ControlButtonProps = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  danger?: boolean;
  onClick(): void;
};

function ControlButton({ label, icon, active, danger, onClick }: ControlButtonProps) {
  const className = ['control-button', active ? 'is-active' : '', danger ? 'is-danger' : ''].filter(Boolean).join(' ');
  const Icon = icon;

  return (
    <button type="button" className={className} aria-label={label} title={label} aria-pressed={active} onClick={onClick}>
      <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
    </button>
  );
}

export function MediaControls({
  micEnabled,
  cameraEnabled,
  screenCount,
  onToggleMic,
  onToggleCamera,
  onStartScreenShare,
  onStopScreenShare,
  onDisconnect
}: MediaControlsProps) {
  return (
    <div className="media-controls">
      <ControlButton label={micEnabled ? 'Mutar microfone' : 'Desmutar microfone'} icon={micEnabled ? Mic : MicOff} active={micEnabled} onClick={onToggleMic} />
      <ControlButton
        label={cameraEnabled ? 'Desligar câmera' : 'Ligar câmera'}
        icon={cameraEnabled ? Video : VideoOff}
        active={cameraEnabled}
        onClick={onToggleCamera}
      />
      <ControlButton label="Compartilhar tela" icon={ScreenShare} onClick={onStartScreenShare} />
      {screenCount > 0 ? <ControlButton label="Parar compartilhamento de tela" icon={ScreenShareOff} danger onClick={onStopScreenShare} /> : null}
      <ControlButton label="Desconectar da call" icon={PhoneOff} danger onClick={onDisconnect} />
    </div>
  );
}
