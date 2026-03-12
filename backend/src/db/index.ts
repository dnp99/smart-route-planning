import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let queryClient: postgres.Sql | null = null;
let dbClient: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Server is missing DATABASE_URL configuration.");
  }

  return databaseUrl;
};

export const getDb = () => {
  if (dbClient) {
    return dbClient;
  }

  queryClient = postgres(getDatabaseUrl(), {
    max: 1,
    prepare: false,
  });

  dbClient = drizzle(queryClient, { schema });
  return dbClient;
};

export const closeDb = async () => {
  if (!queryClient) {
    return;
  }

  await queryClient.end();
  queryClient = null;
  dbClient = null;
};
