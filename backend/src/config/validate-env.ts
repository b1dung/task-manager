type Environment = Record<string, string | undefined>;

export function validateEnvironment(config: Environment): Environment {
  const production = config.NODE_ENV === 'production';
  const required = production
    ? [
        'DB_HOST',
        'DB_USERNAME',
        'DB_PASSWORD',
        'DB_NAME',
        'REDIS_HOST',
        'FRONTEND_URL',
      ]
    : [];
  const missing = required.filter((key) => !config[key]?.trim());
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );

  if (production) {
    for (const key of [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'TWO_FACTOR_ENCRYPTION_KEY',
    ]) {
      if (!config[key] || config[key]!.length < 32) {
        throw new Error(
          `${key} must contain at least 32 characters in production`,
        );
      }
    }
    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      throw new Error('JWT access and refresh secrets must be different');
    }
  }
  return config;
}
