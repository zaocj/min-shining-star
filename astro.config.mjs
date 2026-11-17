// @ts-check
import { defineConfig, envField } from 'astro/config';

import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4321 },
  env: {
    validateSecrets: true,
    schema: {
      HOST: envField.string({ context: 'server', access: 'secret', default: '127.0.0.1' }),
      PORT: envField.number({ context: 'server', access: 'secret', default: 4321, int: true, min: 1, max: 65535 }),
      SITE_URL: envField.string({ context: 'server', access: 'secret', url: true }),
      DATABASE_PATH: envField.string({ context: 'server', access: 'secret', min: 1 }),
      NODE_ENV: envField.enum({ context: 'server', access: 'secret', values: ['development', 'production', 'test'], default: 'development' }),
    },
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ['better-sqlite3'] },
  }
});
