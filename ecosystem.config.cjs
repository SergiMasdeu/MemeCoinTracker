module.exports = {
  apps: [
    {
      name: 'shitcoin-bot',
      script: 'server/index.mjs',
      interpreter: '/usr/bin/node',
      cwd: '/home/bot/Shitcoin',
      env_file: '/home/bot/Shitcoin/.env',
      watch: false,
      autorestart: true,
      restart_delay: 3000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
