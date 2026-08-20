import { DEFAULT_MAX_PARTICIPANTS } from '@minimal-cord/shared';

export interface ServerConfig {
  host: string;
  port: number;
  publicBaseUrl: string;
  maxParticipantsPerRoom: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    publicBaseUrl: env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
    maxParticipantsPerRoom: Number(env.MAX_PARTICIPANTS_PER_ROOM ?? DEFAULT_MAX_PARTICIPANTS)
  };
}
