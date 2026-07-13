import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs as its own CLI process (db:generate / db:migrate / db:push),
// independent of the app runtime. It reads DATABASE_URL directly here.
export default defineConfig({
  dialect: 'postgresql',
  // Both the domain schema and the BetterAuth auth tables (Phase 3b). drizzle-kit
  // reads both and emits ONE migration covering the new auth tables.
  schema: ['./src/db/schema.ts', './src/db/auth-schema.ts'],
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
