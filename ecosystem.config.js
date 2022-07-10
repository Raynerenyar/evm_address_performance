module.exports = {
  apps: [
    {
      script: 'index.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: true,
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 8080,
      },
    },
  ],

  deploy: {
    production: {
      // ref: 'origin/master',
      // repo: 'GIT_REPOSITORY',
      // path: 'DESTINATION_PATH',
      'pre-deploy-local': 'npm i pm2 -g',
      'post-deploy':
        'pm2 reload ecosystem.config.js --env production && pm2 save',
      'pre-setup': '',
    },
  },
};
