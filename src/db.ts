
import { createClient, type ClickHouseSettings } from "@clickhouse/client";

export const clickhouse = createClient({
  url: Bun.env.CLICKHOUSE_HOST,
  username: Bun.env.CLICKHOUSE_USER,
  password: Bun.env.CLICKHOUSE_PASSWORD,
  database: 'WOT',
  clickhouse_settings: { max_temporary_columns: '1000' }
});


export async function query<T>(query: string, settings: ClickHouseSettings = {}) {
  const result = await clickhouse.query({ query, format: 'JSON', clickhouse_settings: settings });
  const response = await result.json<T>()
  return response;
}