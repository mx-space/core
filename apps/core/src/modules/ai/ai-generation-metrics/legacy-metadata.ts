import { sql, type SQLWrapper } from 'drizzle-orm'

/** v17 response fields derived from the durable ledger, without retired columns. */
export function latestMetricField(
  type: 'translation' | 'insights',
  id: SQLWrapper,
  field: 'model' | 'provider_id',
) {
  return sql<
    string | null
  >`(select ${sql.identifier(field)} from ai_generation_metrics m where m.resource_type = ${type} and m.resource_id = ${id} order by m.created_at desc, m.id desc limit 1)`
}
