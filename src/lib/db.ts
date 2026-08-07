import { Pool, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var autonomousCreatorPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({ connectionString });
}

export function database(): Pool {
  if (!globalThis.autonomousCreatorPool) {
    globalThis.autonomousCreatorPool = createPool();
  }

  return globalThis.autonomousCreatorPool;
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();

  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
