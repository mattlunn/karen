import Push from 'pushover-notifications';
import config from '../../config';
import logger from '../../logger';
import bus, { LOG_CREATED } from '../../bus';

const push = new Push({
  token: config.pushover.application_token,
  onerror: logger.error.bind(logger)
});

const SEVERITY_OPTIONS = {
  notice: { priority: 0 },
  warning: { priority: 1 },
  critical: { priority: 2, retry: 60, expire: 3600 }
};

const SEVERITY_PREFIXES = {
  warning: '⚠️ ',
  critical: '🚨 '
};

async function getRecipientTokens(log) {
  if (log.audience === 'admins') {
    return [config.pushover.admin_token];
  }

  const users = await log.getAudienceUsers();

  return users.flatMap(user => user.pushoverToken ? [user.pushoverToken] : []);
}

bus.on(LOG_CREATED, async ({ log, image, sound }) => {
  if (log.severity === 'info') {
    return;
  }

  try {
    const tokens = await getRecipientTokens(log);
    const message = `${SEVERITY_PREFIXES[log.severity] ?? ''}${log.message}`;

    if (tokens.length === 0) {
      return;
    }

    if (config.pushover.mode === 'readonly') {
      logger.info(`Pushover: [readonly] would send "${message}" to ${tokens.length} recipient(s)`);
      return;
    }

    logger.info(`Sending a notification to ${tokens.length} recipient(s)`);

    push.send({
      ...SEVERITY_OPTIONS[log.severity],
      message,
      sound,
      user: tokens.join(','),
      ...(image && { file: { name: 'image.jpg', data: image } })
    }, (err) => {
      if (err) {
        logger.error(err);
      }
    });
  } catch (e) {
    logger.error(e, `Failed to send "${log.message}" to Pushover`);
  }
});
