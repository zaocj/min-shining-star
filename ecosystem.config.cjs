module.exports = {
  apps: [
    {
      name: 'shining-star',
      cwd: __dirname,
      script: './dist/server/entry.mjs',
      node_args: '--env-file=.env.production',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      time: true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
