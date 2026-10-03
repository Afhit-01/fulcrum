import dotenv from "dotenv";

dotenv.config();

const requiredEnv = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const port = Number(requiredEnv("PORT"));

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(
    "Invalid environment variable: PORT must be a positive integer",
  );
}

const parseOptionalPositiveInteger = (
  name: string,
  defaultValue: number,
): number => {
  const value = process.env[name];

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid environment variable: ${name} must be a positive integer`,
    );
  }

  return parsed;
};

export const env = {
  databaseUrl: requiredEnv("DATABASE_URL"),
  jwtSecret: requiredEnv("JWT_SECRET"),
  port,
  authRateLimitMax: parseOptionalPositiveInteger("AUTH_RATE_LIMIT_MAX", 10),
  apiRateLimitMax: parseOptionalPositiveInteger("API_RATE_LIMIT_MAX", 80),
};
