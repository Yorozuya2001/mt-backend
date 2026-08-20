process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'test-access-secret-mt-shop-e2e';
process.env.JWT_ACCESS_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_URL = 'http://127.0.0.1:3000';
process.env.SMTP_HOST = 'localhost';
process.env.SMTP_PORT = '25';
process.env.MAIL_FROM = 'MT SHOP <noreply@mt.local>';
process.env.COOKIE_SECURE = 'false';
process.env.MT_DESKTOP = '1';
process.env.THROTTLE_LIMIT = '100000';
process.env.APP_VERSION = '0.1.0';
