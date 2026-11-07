export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 4000,
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/gym_system?schema=public",
  JWT_SECRET: process.env.JWT_SECRET || "gym-system-super-secret-jwt-key",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "gym-system-super-secret-refresh-key",
  NODE_ENV: process.env.NODE_ENV || "development",
};

