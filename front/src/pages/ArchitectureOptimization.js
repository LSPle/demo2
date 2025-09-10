import React, { useEffect, useState } from 'react';
import { Card, Select, Button, Space, Descriptions, Tag, Table, message, Divider, Tooltip, Alert } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api';

const statusColor = (level) => {
  switch (level) {
    case 'error': return 'red';
    case 'warning': return 'orange';
    case 'success': return 'green';
    default: return 'default';
  }
};

// 英文参数 -> 中文翻译
const OVERVIEW_LABELS = {
  log_bin: '二进制日志开关',
  binlog_format: 'Binlog 格式',
  gtid_mode: 'GTID 模式',
  enforce_gtid_consistency: '强制 GTID 一致性',
  read_only: '只读 (全局)',
  super_read_only: '超级只读',
  rpl_semi_sync_master_enabled: '半同步(主)',
  rpl_semi_sync_slave_enabled: '半同步(从)',
  sync_binlog: 'Binlog 同步策略',
  innodb_flush_log_at_trx_commit: '事务提交刷新策略',
  // 新增采集信号
  binlog_row_image: 'Binlog 行镜像',
  binlog_expire_logs_seconds: 'Binlog 保留时长(秒)',
  master_info_repository: 'Master 信息存储',
  relay_log_info_repository: 'RelayLog 信息存储',
};

const REPL_LABELS = {
  seconds_behind: '复制延迟(秒)',
  io_thread: 'IO 线程',
  sql_thread: 'SQL 线程',
  Replica_SQL_Running_State: 'SQL线程运行状态',
  Executed_Gtid_Set: '已执行 GTID 集合',
  Retrieved_Gtid_Set: '已获取 GTID 集合',
  Last_Error: '最后错误',
};

// 中英混排标签渲染：英文保持原样，中文放入全角括号并使用不同样式
const englishLabelStyle = { fontFamily: 'Segoe UI, Roboto, Helvetica, Arial, sans-serif', fontWeight: 600, color: '#1f1f1f' };
const chineseLabelStyle = { fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif', fontWeight: 400, color: '#8c8c8c', marginLeft: 4 };
const renderMixedLabel = (key) => {
  const cn = OVERVIEW_LABELS[key] || REPL_LABELS[key];
  return (
    <span>
      <span style={englishLabelStyle}>{key}</span>
      {cn ? <span style={chineseLabelStyle}>（{cn}）</span> : null}
    </span>
  );
};

// 用于给 ON/OFF、Yes/No 值上色
const renderStatusTag = (val) => {
  const s = String(val ?? '').toUpperCase();
  if (['ON', 'YES'].includes(s)) return <Tag color="green">{s}</Tag>;
  if (['OFF', 'NO'].includes(s)) return <Tag color="red">{s}</Tag>;
  if (s === 'N/A' || s === 'UNKNOWN' || s === '') return (
    <Tooltip title="该指标暂无数据或不适用。可能原因：1）参数未支持或未启用；2）当前实例角色/版本不适用；3）临时性超时或权限不足导致采集失败。">
      <Tag>{val ?? 'N/A'}</Tag>
    </Tooltip>
  );
  return <Tag color="blue">{val}</Tag>;
};

const ArchitectureOptimization = () => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [instanceOptions, setInstanceOptions] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [overview, setOverview] = useState(null);
  const [replication, setReplication] = useState(null);
  const [riskItems, setRiskItems] = useState([]);
  const [slowData, setSlowData] = useState(null);
  const [isSlowAnalyzing, setIsSlowAnalyzing] = useState(false);

  // 加载实例列表（与其他页面一致）
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.INSTANCES);
        if (!response.ok) throw new Error('API响应失败');
        const data = await response.json();
        const options = (Array.isArray(data) ? data : [])
          .filter((inst) => inst.status !== 'error')
          .map((inst) => ({
            value: String(inst.id),
            label: `${inst.instanceName} (${inst.dbType}) ${inst.host}:${inst.port}`,
            status: inst.status,
          }));
        setInstanceOptions(options);
        if (selectedInstance && !options.some((o) => o.value === selectedInstance)) {
          setSelectedInstance('');
          message.warning('所选实例已不可用，选择已重置');
        }
      } catch (err) {
        console.error('获取实例列表失败:', err);
        message.error('获取数据库实例列表失败，请检查后端服务');
        setInstanceOptions([]);
        if (selectedInstance) setSelectedInstance('');
      }
    };

    fetchInstances();
    const timer = setInterval(fetchInstances, 10000);
    return () => clearInterval(timer);
  }, [selectedInstance]);

  const handleAnalyze = async () => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }
    setIsAnalyzing(true);
    try {
      const response = await fetch(API_ENDPOINTS.ARCH_ANALYZE(selectedInstance), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        let errMsg = `HTTP ${response.status}`;
        try {
          const errBody = await response.json();
          if (errBody && errBody.error) errMsg = errBody.error;
        } catch (_) {
          try {
            const txt = await response.text();
            if (txt) errMsg = txt;
          } catch (__) {}
        }
        console.error('架构分析接口错误:', errMsg);
        message.error(`架构检查失败：${errMsg}`);
        return;
      }
      const data = await response.json();
      const risks = Array.isArray(data.risks) ? data.risks.map((r, idx) => ({ key: r.key || `${r.item || 'risk'}_${idx}`, ...r })) : [];
      setOverview(data.overview || null);
      setReplication(data.replication || null);
      setRiskItems(risks);
      message.success('架构检查完成');

      // 并行触发慢日志分析
      try {
        setIsSlowAnalyzing(true);
        const sresp = await fetch(API_ENDPOINTS.SLOWLOG_ANALYZE(selectedInstance), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ top: 15, min_avg_ms: 10, tail_kb: 256 })
        });
        if (sresp.ok) {
          const sdata = await sresp.json();
          setSlowData(sdata);
        } else {
          try { const sj = await sresp.json(); message.warning(`慢日志分析失败：${sj.error || sresp.status}`); } catch { message.warning('慢日志分析失败'); }
          setSlowData(null);
        }
      } finally {
        setIsSlowAnalyzing(false);
      }
    } catch (e) {
      console.error(e);
      message.error('架构检查失败，请检查后端服务');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const columns = [
    { title: '类别', dataIndex: 'category', key: 'category', width: 160, render: (t) => <Tag>{t}</Tag> },
    { title: '项目', dataIndex: 'item', key: 'item', width: 200 },
    { title: '当前值', dataIndex: 'current', key: 'current', width: 240, render: (t) => (
      <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>{t}</code>
    ) },
    { title: '风险等级', dataIndex: 'level', key: 'level', width: 120, render: (l) => (
      <Tag color={statusColor(l)}>{l === 'error' ? '高' : l === 'warning' ? '中' : '低'}</Tag>
    ) },
    { title: '建议', dataIndex: 'recommendation', key: 'recommendation' },
  ];

  // 概览展示顺序（含新增项）
  const overviewOrder = [
    'log_bin', 'binlog_format', 'gtid_mode', 'enforce_gtid_consistency',
    'read_only', 'super_read_only', 'rpl_semi_sync_master_enabled', 'rpl_semi_sync_slave_enabled',
    'sync_binlog', 'innodb_flush_log_at_trx_commit',
    'binlog_row_image', 'binlog_expire_logs_seconds', 'master_info_repository', 'relay_log_info_repository',
  ];

  const renderOverviewValue = (k, v) => {
    const key = String(k);
    const up = String(v ?? '').toUpperCase();
    if (['log_bin', 'read_only', 'super_read_only', 'rpl_semi_sync_master_enabled', 'rpl_semi_sync_slave_enabled'].includes(key)) {
      return renderStatusTag(v);
    }
    if (['io_thread', 'sql_thread'].includes(key)) return renderStatusTag(v);
    if (['N/A', 'UNKNOWN', ''].includes(up)) return (
      <Tooltip title="该指标暂无数据或不适用。可能原因：1）参数未支持或未启用；2）当前实例角色/版本不适用；3）临时性超时或权限不足导致采集失败。">
        <Tag>{v ?? 'N/A'}</Tag>
      </Tooltip>
    );
    return <Tag color="blue">{String(v)}</Tag>;
  };

  // 复制状态字段顺序（含新增项）
  const replOrder = [
    'seconds_behind', 'io_thread', 'sql_thread', 'Replica_SQL_Running_State',
    'Executed_Gtid_Set', 'Retrieved_Gtid_Set', 'Last_Error',
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 操作条 */}
      <Card style={{ marginBottom: 16 }}>
        <Space size={12} wrap>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#1f1f1f', fontSize: 18, letterSpacing: 0.2 }}>
            <DatabaseOutlined style={{ color: '#722ED1', fontSize: 20 }} />
            选择实例
          </span>
          <Select
            showSearch
            placeholder="请选择实例"
            style={{ width: 380 }}
            value={selectedInstance || undefined}
            onChange={setSelectedInstance}
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={instanceOptions}
          />
          <Button type="primary" loading={isAnalyzing} onClick={handleAnalyze}>
            {isAnalyzing ? '分析中...' : '开始架构检查'}
          </Button>
        </Space>
      </Card>

      {/* 概览 */}
      <Card title="架构概览" style={{ marginBottom: 16 }} bordered>
        {!overview ? (
          <div style={{ color: '#8c8c8c' }}>请先选择实例并点击“开始架构检查”。</div>
        ) : (
          <>
            <Descriptions column={3} size="middle" bordered>
              {overviewOrder.filter((k) => overview[k] !== undefined).map((k) => (
                <Descriptions.Item key={k} label={renderMixedLabel(k)}>
                  {renderOverviewValue(k, overview[k])}
                </Descriptions.Item>
              ))}
            </Descriptions>
            {replication && replication.is_replica ? (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Descriptions title="复制状态" column={2} size="middle" bordered>
                  {replOrder.filter((k) => replication[k] !== undefined).map((k) => (
                    <Descriptions.Item key={k} label={renderMixedLabel(k)}>
                      {renderOverviewValue(k, replication[k])}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </>
            ) : (
              <div style={{ color: '#8c8c8c', marginTop: 8 }}>未检测到从库复制状态。</div>
            )}
          </>
        )}
      </Card>

      {/* 风险与建议 */}
      <Card title="风险与建议" bordered>
        <Table
          size="middle"
          rowKey="key"
          columns={columns}
          dataSource={riskItems}
          pagination={{ pageSize: 8 }}
        />
      </Card>

      {/* 慢查询分析 */}
      <Card title="慢查询分析" style={{ marginTop: 16 }} bordered extra={isSlowAnalyzing ? <Tag color="processing">分析中</Tag> : null}>
        {!slowData ? (
          <div style={{ color: '#8c8c8c' }}>尚无慢日志分析结果。请先点击“开始架构检查”。</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label="performance_schema">{slowData.overview?.performance_schema || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="slow_query_log">{slowData.overview?.slow_query_log || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="long_query_time">{String(slowData.overview?.long_query_time ?? 'N/A')}</Descriptions.Item>
              <Descriptions.Item label="log_output">{slowData.overview?.log_output || 'N/A'}</Descriptions.Item>
              <Descriptions.Item label="slow_log_file" span={2}><code>{slowData.overview?.slow_query_log_file || 'N/A'}</code></Descriptions.Item>
            </Descriptions>

            {Array.isArray(slowData.warnings) && slowData.warnings.length > 0 && (
              <Alert type="warning" showIcon message={slowData.warnings.join('；')} />
            )}

            <div>
              <h3 style={{ marginBottom: 8 }}>Top SQL 指纹（来自 performance_schema）</h3>
              <Table
                size="small"
                rowKey={(r) => r.digest + r.schema}
                dataSource={slowData.ps_top || []}
                pagination={{ pageSize: 8 }}
                columns={[
                  { title: 'Schema', dataIndex: 'schema', key: 'schema', width: 120 },
                  { title: '指纹', dataIndex: 'query', key: 'query', ellipsis: true },
                  { title: '次数', dataIndex: 'count', key: 'count', width: 80 },
                  { title: '平均耗时(ms)', dataIndex: 'avg_latency_ms', key: 'avg_latency_ms', width: 140 },
                  { title: '总耗时(ms)', dataIndex: 'total_latency_ms', key: 'total_latency_ms', width: 140 },
                  { title: 'RowsExamined(avg)', dataIndex: 'rows_examined_avg', key: 'rows_examined_avg', width: 160 },
                  { title: 'RowsSent(avg)', dataIndex: 'rows_sent_avg', key: 'rows_sent_avg', width: 140 },
                ]}
              />
            </div>

            <div>
              <h3 style={{ marginBottom: 8 }}>慢日志表抽样（最近记录）</h3>
              <Table
                size="small"
                rowKey={(r, idx) => String(idx)}
                dataSource={slowData.file_samples || []}
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: '时间', dataIndex: 'time', key: 'time', width: 180 },
                  { title: 'DB', dataIndex: 'db', key: 'db', width: 120 },
                  { title: '查询耗时(ms)', dataIndex: 'query_time_ms', key: 'query_time_ms', width: 140 },
                  { title: '锁等待(ms)', dataIndex: 'lock_time_ms', key: 'lock_time_ms', width: 120 },
                  { title: 'Rows_sent', dataIndex: 'rows_sent', key: 'rows_sent', width: 100 },
                  { title: 'Rows_examined', dataIndex: 'rows_examined', key: 'rows_examined', width: 120 },
                  { title: 'SQL', dataIndex: 'sql', key: 'sql', ellipsis: true },
                ]}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ArchitectureOptimization;