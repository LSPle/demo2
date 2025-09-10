import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Button, Space, Tag, Progress, Alert, Descriptions, message } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ReloadOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api';

const { Option } = Select;

const ConfigOptimization = () => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [slowData, setSlowData] = useState(null);
  const [isSlowAnalyzing, setIsSlowAnalyzing] = useState(false);
  const [instanceOptions, setInstanceOptions] = useState([]);

  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const response = await fetch(API_ENDPOINTS.INSTANCES);
        if (!response.ok) throw new Error('API响应失败');
        const data = await response.json();
        const options = (Array.isArray(data) ? data : [])
          // 仅展示非异常实例，视为"已连接"
          .filter(inst => inst.status !== 'error')
          .map(inst => ({
            value: String(inst.id),
            label: `${inst.instanceName} (${inst.dbType}) ${inst.host}:${inst.port}`,
            status: inst.status
          }));
        setInstanceOptions(options);
        // 如果当前选择的实例已不可用，则重置选择
        if (selectedInstance && !options.some(o => o.value === selectedInstance)) {
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
    const interval = setInterval(fetchInstances, 10000); // 10秒刷新一次，实时更新实例状态
    return () => clearInterval(interval);
  }, [selectedInstance]);

  // 百分比与比值解析工具
  const parsePercent = (s) => {
    if (typeof s !== 'string') return null;
    const m = s.match(/([0-9.]+)%/);
    return m ? parseFloat(m[1]) : null;
  };
  const calcConnPercent = (s) => {
    if (typeof s !== 'string') return null;
    const m = s.match(/(\d+)\/(\d+|\?)/);
    if (m && m[2] !== '?') {
      const used = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      if (total > 0) return Math.round((used / total) * 100);
    }
    return null;
  };

  // 移除前端模拟配置数据，统一来自后端

  const handleInstanceChange = (value) => {
    setSelectedInstance(value);
    setConfigData(null);
  };

  const handleAnalyzeConfig = async () => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }

    setIsAnalyzing(true);
    try {
      const resp = await fetch(API_ENDPOINTS.CONFIG_ANALYZE(selectedInstance), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!resp.ok) {
        let err = '分析接口返回错误';
        try { const j = await resp.json(); err = j.error || err; } catch {}
        throw new Error(err);
      }
      const data = await resp.json();
      if (!data || !data.basicInfo) {
        throw new Error('接口返回数据不完整');
      }
      setConfigData(data);
      message.success('配置分析完成');

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
      message.error(`配置分析失败：${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 删除未使用的配置编辑功能
  // const handleEditConfig = (record) => { ... };
  // const handleSaveConfig = (record) => { ... };
  // const handleApplyAllOptimizations = () => { ... };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return 'green';
      case 'warning': return 'orange';
      case 'error': return 'red';
      default: return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return <CheckCircleOutlined />;
      case 'warning': return <ExclamationCircleOutlined />;
      case 'error': return <CloseCircleOutlined />;
      default: return null;
    }
  };

  // 从配置项中提取特定参数
  const getConfigItem = (name) => {
    const items = configData?.configItems || [];
    return items.find(it => it.parameter === name);
  };

  const isSlowLogEnabled = () => {
    const slow = getConfigItem('slow_query_log');
    const v = String(slow?.currentValue ?? '').toLowerCase();
    return v === 'on' || v === '1' || v === 'true' || v === 'yes';
  };

  // 指标实时刷新（SSE）- 仅在配置优化页面启用
  useEffect(() => {
    // 仅在已选择实例且已有分析结果时启动实时指标刷新
    if (!selectedInstance || !configData) return;

    // 检查是否支持SSE和是否在正确的页面
    if (typeof EventSource === 'undefined') {
      console.warn('浏览器不支持Server-Sent Events');
      return;
    }

    const service = 'mysqld';
    const url = `${API_BASE_URL}/api/metrics/stream?service=${encodeURIComponent(service)}&interval=5`;
    let es;
    let reconnectTimer;
    let reconnectAttempts = 0;
    let isComponentMounted = true;
    const maxReconnectAttempts = 3; // 减少重连次数
    const reconnectDelay = 5000; // 增加重连间隔到5秒

    const applyMetrics = (metrics) => {
      if (!isComponentMounted) return;
      setConfigData((prev) => {
        if (!prev) return prev;
        const memStr = typeof metrics?.memory_usage === 'number' ? `${metrics.memory_usage}%` : prev.basicInfo.memoryUsage;
        let diskStr = prev.basicInfo.diskUsage;
        if (metrics?.disk_usage && typeof metrics.disk_usage.usage_percent === 'number') {
          const p = metrics.disk_usage.usage_percent;
          const display = metrics.disk_usage.storage_display;
          diskStr = display ? `${p}% (${display})` : `${p}%`;
        }
        return {
          ...prev,
          basicInfo: {
            ...prev.basicInfo,
            memoryUsage: memStr,
            diskUsage: diskStr,
          }
        };
      });
    };

    const connectSSE = () => {
      if (!isComponentMounted) return;
      
      try {
        if (es) {
          es.close();
        }
        
        es = new EventSource(url);

        es.addEventListener('open', () => {
          if (isComponentMounted) {
            reconnectAttempts = 0;
          }
        });

        es.addEventListener('metrics', (e) => {
          if (!isComponentMounted) return;
          try {
            const data = JSON.parse(e.data);
            applyMetrics(data);
          } catch (err) {
            // 静默处理解析错误
          }
        });

        es.addEventListener('error', (e) => {
          if (!isComponentMounted) return;
          
          // 只在连接完全失败且重连次数未达上限时重连
          if (es.readyState === EventSource.CLOSED && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            reconnectTimer = setTimeout(() => {
              if (isComponentMounted) {
                connectSSE();
              }
            }, reconnectDelay);
          }
        });

      } catch (err) {
        // 静默处理初始化错误
      }
    };

    // 延迟启动SSE连接，避免页面加载时的竞争条件
    const initTimer = setTimeout(() => {
      if (isComponentMounted) {
        connectSSE();
      }
    }, 1000);

    return () => {
      isComponentMounted = false;
      if (initTimer) {
        clearTimeout(initTimer);
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (es) {
        es.close();
      }
    };
  }, [selectedInstance, configData]);

  const configColumns = [
    {
      title: '参数名称',
      dataIndex: 'parameter',
      key: 'parameter',
      width: 200,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.description}</div>
        </div>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => <Tag>{text}</Tag>
    },
    {
      title: '当前值',
      dataIndex: 'currentValue',
      key: 'currentValue',
      width: 120,
      render: (text) => (
        <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
          {text}
        </code>
      )
    },
    {
      title: '建议值',
      dataIndex: 'recommendedValue',
      key: 'recommendedValue',
      width: 120,
      render: (text, record) => (
        <code style={{ 
          backgroundColor: record.status === 'success' ? '#f6ffed' : '#fff2e8', 
          padding: '2px 6px', 
          borderRadius: 4,
          color: record.status === 'success' ? '#52c41a' : '#fa8c16'
        }}>
          {text}
        </code>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={getStatusColor(status)} icon={getStatusIcon(status)}>
          {status === 'success' ? '正常' : status === 'warning' ? '建议优化' : '需要优化'}
        </Tag>
      )
    },
    {
      title: '影响程度',
      dataIndex: 'impact',
      key: 'impact',
      width: 100,
      render: (impact) => {
        const color = impact === '高' ? 'red' : impact === '中等' ? 'orange' : impact === '低' ? 'blue' : 'default';
        return <Tag color={color}>{impact}</Tag>;
      }
    }
    // 已删除“操作”列
  ];

  return (
    <div className="fade-in-up">
      {/* 页面标题 */}
      <div className="page-header">
        <h1>配置优化</h1>
        <p>分析和优化数据库实例的配置参数</p>
      </div>

      {/* 实例选择和分析 */}
      <Card className="content-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <div>
              <span style={{ fontWeight: 500, marginRight: 12 }}>选择实例:</span>
              <Select
                placeholder="请选择要分析的实例"
                style={{ width: 360 }}
                value={selectedInstance}
                onChange={handleInstanceChange}
                notFoundContent="暂无可用实例"
                loading={!instanceOptions.length}
              >
                {instanceOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
          
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={handleAnalyzeConfig}
              loading={isAnalyzing}
              disabled={!selectedInstance}
            >
              {isAnalyzing ? '分析中...' : '开始分析'}
            </Button>
            {configData && (
              <Button
                icon={<ReloadOutlined />}
                onClick={handleAnalyzeConfig}
              >
                重新分析
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* 分析结果 */}
      {configData && (
        <div>
          {/* 概览信息 */}
          <Card title="实例概览" className="content-card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="实例名称">{configData.basicInfo.instanceName}</Descriptions.Item>
                {/* 移除版本显示以保持一致 */}
                <Descriptions.Item label="实例类型">{configData.basicInfo.type}</Descriptions.Item>
                {/* 移除版本显示以保持一致 */}
                <Descriptions.Item label="运行时间">{configData.basicInfo.uptime}</Descriptions.Item>
              </Descriptions>
              
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>连接数</span>
                    <span>{configData.basicInfo.connections}</span>
                  </div>
                  <Progress percent={calcConnPercent(configData.basicInfo.connections) || 0} size="small" />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span>慢查询日志</span>
                    <Tag color={isSlowLogEnabled() ? 'green' : 'red'}>
                      {isSlowLogEnabled() ? '已开启' : '未开启'}
                    </Tag>
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>缓冲池大小</span>
                    <span>
                      <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>
                        {getConfigItem('innodb_buffer_pool_size')?.currentValue || '未知'}
                      </code>
                      <span style={{ color: '#8c8c8c', margin: '0 6px' }}>/</span>
                      <span style={{ color: '#8c8c8c' }}>建议</span>
                      <code style={{ backgroundColor: '#fff2e8', padding: '2px 6px', borderRadius: 4, marginLeft: 6 }}>
                        {getConfigItem('innodb_buffer_pool_size')?.recommendedValue || '—'}
                      </code>
                    </span>
                  </div>
                </div>
              </div>
              
              <div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 'bold', color: '#1890ff', marginBottom: 8 }}>
                    {configData.optimizationSummary.score}
                  </div>
                  <div style={{ color: '#8c8c8c' }}>配置健康度</div>
                </div>
                
                <div style={{ marginTop: 16, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>总配置项:</span>
                    <span>{configData.optimizationSummary.totalItems}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>需要优化:</span>
                    <span style={{ color: '#fa8c16' }}>{configData.optimizationSummary.needOptimization}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>高影响项:</span>
                    <span style={{ color: '#ff4d4f' }}>{configData.optimizationSummary.highImpact}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* 慢查询分析 */}
          <Card title="慢查询分析" className="content-card" style={{ marginBottom: 24 }} extra={isSlowAnalyzing ? <Tag color="processing">分析中</Tag> : null}>
            {!slowData ? (
              <div style={{ color: '#8c8c8c' }}>尚无慢日志分析结果。{isSlowAnalyzing ? '' : '请点击开始分析后自动生成。'}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                <div>
                  <Descriptions size="small" column={3} bordered>
                    <Descriptions.Item label="performance_schema">{slowData.overview?.performance_schema || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="slow_query_log">{slowData.overview?.slow_query_log || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="long_query_time">{String(slowData.overview?.long_query_time ?? 'N/A')}</Descriptions.Item>
                    <Descriptions.Item label="log_output">{slowData.overview?.log_output || 'N/A'}</Descriptions.Item>
                    <Descriptions.Item label="slow_log_file" span={2}><code>{slowData.overview?.slow_query_log_file || 'N/A'}</code></Descriptions.Item>
                  </Descriptions>
                </div>

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

          {/* 配置详情 */}
          <Card 
            title="配置参数详情" 
            className="content-card"
          >
            <Alert
              message="配置优化建议"
              description="以下是基于当前实例状态和最佳实践生成的配置优化建议，请谨慎评估后再应用到生产环境。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Table
              columns={configColumns}
              dataSource={configData.configItems}
              rowKey={(r) => r.parameter}
              pagination={false}
              size="middle"
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '12px 0' }}>
                    <strong>优化原因:</strong> {record.reason}
                  </div>
                ),
                rowExpandable: (record) => !!record.reason
              }}
            />
          </Card>
        </div>
      )}

      {/* 空状态 */}
      {!configData && !isAnalyzing && (
        <Card className="content-card">
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#8c8c8c' }}>
            <DatabaseOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <div style={{ fontSize: 16, marginBottom: 8 }}>请选择数据库实例并开始分析</div>
            <div>系统将自动检测配置参数并提供优化建议</div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ConfigOptimization;