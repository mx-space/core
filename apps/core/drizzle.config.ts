import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url:
      process.env.PG_URL ||
      process.env.PG_CONNECTION_STRING ||
      'postgres://mx:mx@127.0.0.1:5432/mx_core',
  },
  verbose: true,
  strict: true,
})
