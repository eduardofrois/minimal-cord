import { createApp } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
const app = await createApp({ maxParticipantsPerRoom: config.maxParticipantsPerRoom });

await app.listen({ host: config.host, port: config.port });
