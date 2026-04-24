exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'smart-home-lambda'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: { enabled: true },
  application_logging: { forwarding: { enabled: true } },
  logging: { level: 'info' },
  serverless_mode: { enabled: true },
};
