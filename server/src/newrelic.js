const { newrelic } = require('./config/app');

/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
  app_name: [newrelic.app_name],
  license_key: newrelic.license_key,

  /**
   * This setting controls distributed tracing.
   * Distributed tracing lets you see the path that a request takes through your
   * distributed system. Enabling distributed tracing changes the behavior of some
   * New Relic features, so carefully consult the transition guide before you enable
   * this feature: https://docs.newrelic.com/docs/transition-guide-distributed-tracing
   * Default is true.
   */
  distributed_tracing: {
    /**
     * Enables/disables distributed tracing.
     *
     * @env NEW_RELIC_DISTRIBUTED_TRACING_ENABLED
     */
    enabled: true
  },
  application_logging: {
    forwarding: {
      enabled: true
    }
  },
  logging: {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level: 'info'
  },
  /**
   * When true, all request headers except for those listed in attributes.exclude
   * will be captured for all traces, unless otherwise specified in a destination's
   * attributes include/exclude lists.
   */
  allow_all_headers: true,
  attributes: {
    /**
     * Prefix of attributes to exclude from all destinations. Allows * as wildcard
     * at end.
     *
     * NOTE: If excluding headers, they must be in camelCase form to be filtered.
     *
     * @env NEW_RELIC_ATTRIBUTES_EXCLUDE
     */
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*'
    ]
  },

  transaction_tracer: {
    record_sql: 'raw'
  },
  
  slow_sql: {
    enabled: true
  },

  feature_flag: {
    /**
     * The undici/fetch subscriber reports every outbound connection failure as a
     * transaction error, with no way to tell that the caller caught it (unlike
     * the http/https instrumentation, which backs off when an 'error' listener
     * is attached). That turns an expected "LAN device is powered off" poll
     * failure (e.g. the Sony Bravia) into constant error noise. Disable it and
     * notice outbound errors explicitly where they actually matter.
     *
     * This is a pre-release flag (agent lib/feature_flags.js -> exports.prerelease,
     * defaults on). Re-check it on major agent upgrades: if it's removed or
     * graduated, auto-capture comes back.
     */
    undici_error_tracking: false
  }
};
