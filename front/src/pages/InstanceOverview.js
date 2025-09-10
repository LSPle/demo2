import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Progress, Space, Button, message, Tooltip, Badge } from 'antd';
import {
  DatabaseOutlined,
  PlayCircleOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  WifiOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';
import { useInstanceStatus } from '../hooks/useInstanceStatus';

const InstanceOverview = () => {
  // 状态管理
  const [instanceData, setInstanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // 使用WebSocket实时状态管理
  const {
    instances: realtimeInstances,
    isConnected,
    lastUpdate,
    refreshAllInstances,
    statusStats,
    reconnect,
    loading: wsLoading
  } = useInstanceStatus();
  const [statsData, setStatsData] = useState([
    {
      title: '总实例数',
      value: 0,
      color: '#1890ff',
      icon: <DatabaseOutlined />,
      trend: { text: '—', type: 'up' }
    },
    {
      title: '运行中',
      value: 0,
      color: '#52c41a',
      icon: <PlayCircleOutlined />,
      trend: { text: '—', type: 'up' }
    },
    {
      title: '异常实例',
      value: 0,
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />,
      trend: { text: '—', type: 'down' }
    }
  ]);

  const eventSourceRef = null; // Disabled: SSE connection closed per Plan A

  // 模拟后端API数据（包含指定的测试实例）
  const mockApiData = [
    // 已移除：不再使用前端模拟数据，避免展示非真实实例
  ];

  // 从后端获取实例数据（包含实时指标）
  const fetchInstanceData = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.INSTANCES);
      if (!response.ok) throw new Error('API响应失败');
      const data = await response.json();
      processInstanceData(data);
    } catch (error) {
      console.error('获取实例数据失败:', error);
      message.error('获取实例数据失败，请检查后端服务');
      setInstanceData([]);
      updateStatsData([]);
    } finally {
      setLoading(false);
    }
  };

  // 手动刷新所有实例状态
  const handleRefreshAll = async () => {
    try {
      setRefreshing(true);
      if (isConnected) {
        // 使用WebSocket刷新
        await refreshAllInstances();
        message.success('已请求刷新所有实例状态');
      } else {
        // 回退到HTTP请求
        await fetchInstanceData();
        message.success('实例状态已刷新');
      }
    } catch (error) {
      message.error('刷新失败，请重试');
    } finally {
      setRefreshing(false);
    }
  };

  // 合并实时数据和本地数据
  const getMergedInstanceData = () => {
    if (realtimeInstances.length > 0) {
      // 使用实时数据，转换格式
      return realtimeInstances.map(instance => ({
        key: instance.id,
        name: instance.instanceName || instance.instance_name,
        ip: `${instance.host}:${instance.port}`,
        type: instance.dbType || instance.db_type,
        status: instance.status,
        cpuUsage: instance.cpuUsage || instance.cpu_usage,
        memoryUsage: instance.memoryUsage || instance.memory_usage,
        storage: instance.storage,
        connectionInfo: {
          host: instance.host,
          port: instance.port,
          username: instance.username,
          password: instance.password
        }
      }));
    }
    return instanceData;
  };

  // 处理实例数据
  const processInstanceData = (data) => {
    // 转换后端数据格式以匹配前端展示需求
    const formattedData = data.map(instance => ({
      key: instance.id,
      name: instance.instanceName,
      ip: `${instance.host}:${instance.port}`,
      type: instance.dbType,
      status: instance.status,
      cpuUsage: instance.cpuUsage,
      memoryUsage: instance.memoryUsage,
      storage: instance.storage,
      connectionInfo: {
        host: instance.host,
        port: instance.port,
        username: instance.username,
        password: instance.password
      }
    }));
    
    setInstanceData(formattedData);
    
    // 更新统计数据
    updateStatsData(formattedData);
  };

  // 更新统计数据
  const updateStatsData = (instances) => {
    const totalCount = instances.length;
    const runningCount = instances.filter(item => item.status === 'running').length;
    const errorCount = instances.filter(item => item.status === 'error').length;

    setStatsData(prevStats => prevStats.map((stat, index) => {
      const values = [totalCount, runningCount, errorCount];
      return {
        ...stat,
        value: values[index]
      };
    }));
  };

  // 组件挂载时获取数据，并设置更频繁的轮询（每10秒）
  useEffect(() => {
    fetchInstanceData();
    const interval = setInterval(fetchInstanceData, 10000);


    return () => {
      clearInterval(interval);
    };
  }, []);

  // 监听实时数据变化，更新统计信息
  useEffect(() => {
    if (realtimeInstances.length > 0) {
      updateStatsData(realtimeInstances);
    } else if (statusStats && statusStats.total !== undefined) {
      // 使用WebSocket提供的统计数据
      const statsArray = [
        {
          title: '总实例数',
          value: statusStats.total || 0,
          color: '#1890ff',
          icon: <DatabaseOutlined />,
          trend: { type: 'stable', text: '总数' }
        },
        {
          title: '运行中',
          value: statusStats.running || 0,
          color: '#52c41a',
          icon: <PlayCircleOutlined />,
          trend: { type: 'up', text: '正常运行' }
        },
        {
          title: '异常',
          value: statusStats.error || 0,
          color: '#ff4d4f',
          icon: <ExclamationCircleOutlined />,
          trend: { type: 'down', text: '需要关注' }
        }
      ];
      setStatsData(statsArray);
    }
  }, [realtimeInstances.length, statusStats?.total, statusStats?.running, statusStats?.error]);

  

  const getStatusTag = (status) => {
    const statusMap = {
      running: { color: 'success', text: '运行中' },
      error: { color: 'error', text: '异常' }
    };
    // 确保status有值，如果为undefined/null则使用'error'
    const normalizedStatus = status || 'error';
    const config = statusMap[normalizedStatus] || statusMap.error;
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getProgressColor = (value) => {
    if (value >= 90) return '#ff4d4f';
    if (value >= 70) return '#faad14';
    return '#52c41a';
  };

  const columns = [
    {
      title: '实例名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <DatabaseOutlined style={{ color: '#1890ff' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{text}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.ip}</div>
          </div>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type'
    },
    // 移除版本列
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
  ];

  return (
    <div className="fade-in-up">
      {/* 页面标题 */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>实例概览</h1>
          <p>实时监控数据库实例状态和性能指标</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* 连接状态指示器 */}
          <Tooltip title={isConnected ? `实时连接正常${lastUpdate ? ` (最后更新: ${new Date(lastUpdate).toLocaleTimeString()})` : ''}` : '连接已断开，点击重连'}>
            <Badge 
              status={isConnected ? 'processing' : 'error'} 
              text={
                <span style={{ 
                  color: isConnected ? '#52c41a' : '#ff4d4f',
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  <WifiOutlined style={{ marginRight: 4 }} />
                  {isConnected ? '实时连接' : '连接断开'}
                </span>
              }
              style={{ cursor: isConnected ? 'default' : 'pointer' }}
              onClick={!isConnected ? reconnect : undefined}
            />
          </Tooltip>
          
          {/* 刷新按钮 */}
          <Tooltip title="手动刷新所有实例状态">
            <Button
              type="primary"
              icon={<ReloadOutlined spin={refreshing || wsLoading} />}
              loading={refreshing || wsLoading}
              onClick={handleRefreshAll}
              size="large"
              style={{
                background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
                border: 'none',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
                fontWeight: 600,
                height: '40px',
                minWidth: '120px'
              }}
            >
              {refreshing || wsLoading ? '刷新中...' : '刷新状态'}
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        {statsData.map((stat, index) => {
          const cardClass = stat.color === '#52c41a' ? 'success' : 
                           stat.color === '#ff4d4f' ? 'error' : '';
          return (
            <div 
              key={index} 
              className={`stat-card ${cardClass} fade-in-up`}
              style={{
                animationDelay: `${index * 0.1}s`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, color: '#8c8c8c', marginBottom: 8 }}>
                    {stat.title}
                  </div>
                  <div style={{ 
                    fontSize: 32, 
                    fontWeight: 700, 
                    color: stat.color, 
                    marginBottom: 8,
                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', display: 'flex', alignItems: 'center' }}>
                    {stat.trend.text}
                    {stat.trend.type === 'up' && <ArrowUpOutlined style={{ color: '#52c41a', marginLeft: 4 }} />}
                    {stat.trend.type === 'down' && <ArrowDownOutlined style={{ color: '#ff4d4f', marginLeft: 4 }} />}
                  </div>
                </div>
                <div style={{ 
                  fontSize: 28, 
                  color: stat.color,
                  background: `${stat.color}15`,
                  padding: '12px',
                  borderRadius: '12px',
                  transition: 'all 0.3s ease'
                }}>
                  {stat.icon}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 数据库实例列表 */}
      <Card
        title="数据库实例列表"
        className="content-card fade-in-up"
        style={{
          animationDelay: '0.4s'
        }}
      >
        <Table
          columns={columns}
          dataSource={getMergedInstanceData()}
          loading={loading || wsLoading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
          }}
          rowClassName={(record, index) => `fade-in-up`}
          style={{
            '--animation-delay': '0.6s'
          }}
        />
      </Card>
    </div>
  );
};

export default InstanceOverview;