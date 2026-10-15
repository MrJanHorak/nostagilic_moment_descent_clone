// Local browser fixture for the first M1 checkpoint; never opens a browser window.
import { createServer } from 'vite';

const server = await createServer({
  server: { host: '127.0.0.1', port: 5183, strictPort: true, open: false },
});
await server.listen();
console.log('Startup smoke check: http://127.0.0.1:5183/?smoke=1');
