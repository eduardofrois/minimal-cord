import { describe, expect, it } from 'vitest';
import { buildWebRtcTransportOptions, parseMediasoupConfig } from './mediasoupService.js';

describe('mediasoup config helpers', () => {
  it('parses port range and announced ip', () => {
    const config = parseMediasoupConfig({
      MEDIASOUP_LISTEN_IP: '0.0.0.0',
      MEDIASOUP_ANNOUNCED_IP: '203.0.113.10',
      MEDIASOUP_MIN_PORT: '40000',
      MEDIASOUP_MAX_PORT: '49999'
    });

    expect(config.worker.rtcMinPort).toBe(40000);
    expect(config.worker.rtcMaxPort).toBe(49999);
    expect(config.webRtcTransport.listenInfos?.[0]?.announcedAddress).toBe('203.0.113.10');
  });

  it('builds WebRTC transport options for mediasoup', () => {
    const options = buildWebRtcTransportOptions({
      listenIp: '0.0.0.0',
      announcedIp: '127.0.0.1'
    });

    expect(options.enableUdp).toBe(true);
    expect(options.enableTcp).toBe(true);
    expect(options.preferUdp).toBe(true);
  });
});
