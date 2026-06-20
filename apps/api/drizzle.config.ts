import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs as its own CLI process (db:generate / db:migrate / db:push),
// independent of the app runtime. It reads DATABASE_URL directly here.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
