import postgres from 'postgres'
import dotenv from 'dotenv'
dotenv.config()

export const sql = postgres(process.env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10
})
