// A minimal WebSocket server connection (RFC 6455) on Node's http upgrade, so
// the game server needs no dependencies. Text and control frames only; client
// frames must be masked, as browsers always do.
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Completes the handshake. Returns null (and rejects) for a bad upgrade request. */
export function acceptWebSocket(request, socket, { maxMessageBytes = 65536 } = {}) {
  const key = request.headers['sec-websocket-key'];
  if (request.headers.upgrade?.toLowerCase() !== 'websocket' || typeof key !== 'string' || request.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  return new WebSocketConnection(socket, maxMessageBytes);
}

/** Emits 'message' (string) and 'close' (code). */
export class WebSocketConnection extends EventEmitter {
  constructor(socket, maxMessageBytes) {
    super();
    this.socket = socket; this.maxMessageBytes = maxMessageBytes;
    this.buffer = Buffer.alloc(0); this.fragments = []; this.closed = false;
    socket.on('data', chunk => this.receive(chunk));
    socket.on('close', () => this.finish(1006));
    socket.on('error', () => this.finish(1006));
  }

  get open() { return !this.closed; }

  /** @param {string} text */
  send(text) { if (!this.closed) this.socket.write(frame(0x1, Buffer.from(text))); }

  close(code = 1000, reason = '') {
    if (this.closed) return;
    const payload = Buffer.alloc(2 + Buffer.byteLength(reason)); payload.writeUInt16BE(code, 0); payload.write(reason, 2);
    this.socket.write(frame(0x8, payload));
    this.socket.end();
    this.finish(code);
  }

  finish(code) {
    if (this.closed) return;
    this.closed = true; this.socket.destroy(); this.emit('close', code);
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (!this.closed) {
      const parsed = parseFrame(this.buffer, this.maxMessageBytes);
      if (parsed === null) return;
      if (parsed.error) { this.close(parsed.error, 'protocol'); return; }
      this.buffer = this.buffer.subarray(parsed.length);
      this.handle(parsed);
    }
  }

  handle({ fin, opcode, payload }) {
    if (opcode === 0x8) { this.close(1000); return; }
    if (opcode === 0x9) { this.socket.write(frame(0xA, payload)); return; }
    if (opcode === 0xA) return;
    if (opcode === 0x2) { this.close(1003, 'text only'); return; }
    if (opcode === 0x1 || opcode === 0x0) {
      this.fragments.push(payload);
      const size = this.fragments.reduce((total, part) => total + part.length, 0);
      if (size > this.maxMessageBytes) { this.close(1009, 'too large'); return; }
      if (fin) { const text = Buffer.concat(this.fragments).toString('utf8'); this.fragments = []; this.emit('message', text); }
      return;
    }
    this.close(1002, 'opcode');
  }
}

/** One frame from the front of `buffer`: null if incomplete, {error} if invalid. */
export function parseFrame(buffer, maxBytes) {
  if (buffer.length < 2) return null;
  const fin = (buffer[0] & 0x80) !== 0, opcode = buffer[0] & 0x0f, masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f, offset = 2;
  if (!masked) return { error: 1002 };
  if (length === 126) { if (buffer.length < 4) return null; length = buffer.readUInt16BE(2); offset = 4; }
  else if (length === 127) { if (buffer.length < 10) return null; const big = buffer.readBigUInt64BE(2); if (big > BigInt(maxBytes)) return { error: 1009 }; length = Number(big); offset = 10; }
  if (length > maxBytes) return { error: 1009 };
  if (buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4), payload = Buffer.from(buffer.subarray(offset + 4, offset + 4 + length));
  for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
  return { fin, opcode, payload, length: offset + 4 + length };
}

/** An unmasked server frame. */
export function frame(opcode, payload) {
  const length = payload.length;
  const header = length < 126 ? Buffer.from([0x80 | opcode, length])
    : length < 65536 ? Buffer.from([0x80 | opcode, 126, length >> 8, length & 0xff])
      : Buffer.concat([Buffer.from([0x80 | opcode, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(length)); return b; })()]);
  return Buffer.concat([header, payload]);
}
