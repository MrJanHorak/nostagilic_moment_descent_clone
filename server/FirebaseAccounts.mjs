import { createHash, verify } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseProgress } from '../src/js/core/ProgressBackup.js';

const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/** Verify Firebase ID tokens against Google's published certificates. */
export function createFirebaseVerifier(projectId, { fetchImpl = fetch, now = () => Date.now() } = {}) {
  let certificates = {}, expiresAt = 0;
  return async token => {
    if (!projectId || typeof token !== 'string' || token.length > 8192) throw new Error('unauthorized');
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('unauthorized');
    let header, claims;
    try { header = JSON.parse(Buffer.from(parts[0], 'base64url')); claims = JSON.parse(Buffer.from(parts[1], 'base64url')); }
    catch { throw new Error('unauthorized'); }
    const seconds = Math.floor(now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid ||
        claims.aud !== projectId || claims.iss !== `https://securetoken.google.com/${projectId}` ||
        typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
        !Number.isFinite(claims.exp) || claims.exp <= seconds || !Number.isFinite(claims.iat) || claims.iat > seconds ||
        !Number.isFinite(claims.auth_time) || claims.auth_time > seconds) throw new Error('unauthorized');
    if (now() >= expiresAt || !Object.hasOwn(certificates, header.kid)) {
      const response = await fetchImpl(CERT_URL, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('identity-unavailable');
      const next = await response.json();
      if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('identity-unavailable');
      certificates = next;
      const maxAge = /(?:^|,)\s*max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '');
      expiresAt = now() + Math.min(86400, Number(maxAge?.[1] ?? 300)) * 1000;
    }
    const cert = Object.hasOwn(certificates, header.kid) ? certificates[header.kid] : null;
    if (typeof cert !== 'string' || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), cert, Buffer.from(parts[2], 'base64url'))) throw new Error('unauthorized');
    return claims.sub;
  };
}

/** Durable, per-user progress with optimistic concurrency in a single server process. */
export function createAccountStore(dataDir) {
  const pending = new Map();
  const directory = join(dataDir, 'accounts');
  const pathFor = uid => join(directory, `${createHash('sha256').update(uid).digest('hex')}.json`);
  const read = async uid => {
    try {
      const data = JSON.parse(await readFile(pathFor(uid), 'utf8'));
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error('corrupt-save');
      parseProgress(JSON.stringify(data.progress));
      return data;
    } catch (error) { if (error.code === 'ENOENT') return { revision: 0, progress: null }; throw error; }
  };
  return {
    read,
    async write(uid, revision, progress) {
      parseProgress(JSON.stringify(progress));
      const previous = pending.get(uid) ?? Promise.resolve();
      const operation = previous.catch(() => {}).then(async () => {
        const current = await read(uid);
        if (revision !== current.revision) return { conflict: true, revision: current.revision };
        await mkdir(directory, { recursive: true });
        const next = { revision: current.revision + 1, progress };
        const path = pathFor(uid), temp = `${path}.${randomBytes(8).toString('hex')}.tmp`;
        await writeFile(temp, JSON.stringify(next)); await rename(temp, path);
        return next;
      });
      pending.set(uid, operation);
      try { return await operation; } finally { if (pending.get(uid) === operation) pending.delete(uid); }
    },
  };
}
