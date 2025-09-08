// API配置
const API_BASE_URL = '';

export const API_ENDPOINTS = {
  INSTANCES: `/api/instances`,
  INSTANCE_DATABASES: (id) => `/api/instances/${id}/databases`,
  INSTANCE_DETAIL: (id) => `/api/instances/${id}`,
  DATABASE_TABLES: (instanceId, database) => `/api/instances/${instanceId}/databases/${encodeURIComponent(database)}/tables`,
  TABLE_SCHEMA: (instanceId, database, table) => `/api/instances/${instanceId}/databases/${encodeURIComponent(database)}/tables/${encodeURIComponent(table)}/schema`,
  SQL_EXECUTE: `/api/sql/execute`,
  SQL_ANALYZE: `/api/sql/analyze`,
  // 新增：配置分析接口（POST）
  CONFIG_ANALYZE: (id) => `/api/instances/${id}/config/analyze`,
  // 新增：架构分析接口（POST）
  ARCH_ANALYZE: (id) => `/api/instances/${id}/arch/analyze`,
  SLOWLOG_ANALYZE: (id) => `/api/instances/${id}/slowlog/analyze`,
  // 新增：慢日志列表（GET）
  SLOWLOG_LIST: (id) => `/api/instances/${id}/slowlog`,
  METRICS: `/api/metrics`,
};

export default API_BASE_URL;