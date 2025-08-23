import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Progress, Space, Button, message } from 'antd';
import {
  DatabaseOutlined,
  PlayCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';

const InstanceOverview = () => {
  // 状态管理
  const [instanceData, setInstanceData] = useState([]);
  const [loading, setLoading] = useState(true);
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
      title: '需要优化',
      value: 0,
      color: '#faad14',
      icon: <WarningOutlined />,
      trend: { text: '—', type: 'down' }
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
    const warningCount = instances.filter(item => item.status === 'warning').length;
    const errorCount = instances.filter(item => item.status === 'error').length;

    setStatsData(prevStats => prevStats.map((stat, index) => {
      const values = [totalCount, runningCount, warningCount, errorCount];
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

  

  const getStatusTag = (status) => {
    const statusMap = {
      running: { color: 'success', text: '运行中' },
      warning: { color: 'warning', text: '需要优化' },
      error: { color: 'error', text: '异常' }
    };
    const config = statusMap[status];
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
      <div className="page-header">
        <h1>实例概览</h1>
        <p>数据库实例运行状态总览</p>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        {statsData.map((stat, index) => {
          const cardClass = stat.color === '#52c41a' ? 'success' : 
                           stat.color === '#faad14' ? 'warning' : 
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
          dataSource={instanceData}
          loading={loading}
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