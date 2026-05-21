export interface Env {
  // Database
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_DB: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;

  // Auth
  JWT_SECRET: string;

  // Seed
  SUPERADMIN_EMAIL: string;
  SUPERADMIN_PASSWORD: string;

  // MercadoPago
  MP_ACCESS_TOKEN: string;
  MP_PUBLIC_KEY: string;
  MP_NOTIFICATION_URL: string;
  MP_WEBHOOK_SECRET: string;

  // Frontend
  FRONTEND_URL: string;

  // Mail
  RESEND_API_KEY: string;
  MAIL_FROM: string;

  // API
  API_URL: string; // para el logo en templates de email
}
