import React from 'react';
import { Card, Table, Tag, Progress, Space, Button } from 'antd';
import {
  DatabaseOutlined,
  PlayCircleOutlined,
  WarningOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  SettingOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';

const InstanceOverview = () => {
  // 统计数据
  const statsData = [
    {
      title: '总实例数',
      value: 12,
      trend: { type: 'up', value: 2, text: '较上月增长 2' },
      color: '#1890ff',
      icon: <DatabaseOutlined />
    },
    {
      title: '运行中',
      value: 10,
      trend: { type: 'up', value: 83, text: '正常运行率 83%' },
      color: '#52c41a',
      icon: <PlayCircleOutlined />
    },
    {
      title: '需要优化',
      value: 3,
      trend: { type: 'warning', text: '需及时处理' },
      color: '#faad14',
      icon: <WarningOutlined />
    },
    {
      title: '异常实例',
      value: 2,
      trend: { type: 'down', value: 1, text: '较昨日增加 1' },
      color: '#ff4d4f',
      icon: <ExclamationCircleOutlined />
    }
  ];

  // 实例数据
  const instanceData = [
    {
      key: '1',
      name: '主数据库-生产环境',
      ip: '192.168.1.101:3306',
      type: 'MySQL',
      version: '8.0.23',
      status: 'running',
      cpuUsage: 35,
      memoryUsage: 65,
      storage: '120GB / 200GB'
    },
    {
      key: '2',
      name: '从数据库-生产环境',
      ip: '192.168.1.102:3306',
      type: 'MySQL',
      version: '8.0.23',
      status: 'running',
      cpuUsage: 28,
      memoryUsage: 45,
      storage: '100GB / 200GB'
    },
    {
      key: '3',
      name: 'Redis缓存集群',
      ip: '192.168.1.105:6379',
      type: 'Redis',
      version: '6.2.5',
      status: 'warning',
      cpuUsage: 78,
      memoryUsage: 92,
      storage: '45GB / 50GB'
    },
    {
      key: '4',
      name: 'MongoDB-日志数据库',
      ip: '192.168.1.108:27017',
      type: 'MongoDB',
      version: '5.0.3',
      status: 'error',
      cpuUsage: 95,
      memoryUsage: 98,
      storage: '190GB / 200GB'
    }
  ];

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
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: getStatusTag
    },
    {
      title: 'CPU使用率',
      dataIndex: 'cpuUsage',
      key: 'cpuUsage',
      render: (value) => (
        <div style={{ width: 100 }}>
          <Progress
            percent={value}
            size="small"
            strokeColor={getProgressColor(value)}
            format={(percent) => `${percent}%`}
          />
        </div>
      )
    },
    {
      title: '内存使用率',
      dataIndex: 'memoryUsage',
      key: 'memoryUsage',
      render: (value) => (
        <div style={{ width: 100 }}>
          <Progress
            percent={value}
            size="small"
            strokeColor={getProgressColor(value)}
            format={(percent) => `${percent}%`}
          />
        </div>
      )
    },
    {
      title: '存储',
      dataIndex: 'storage',
      key: 'storage'
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />}>
            查看
          </Button>
          <Button type="link" size="small" icon={<SettingOutlined />}>
            配置
          </Button>
        </Space>
      )
    }
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
        extra={
          <Space>
            <Button 
              type="primary" 
              icon={<EyeOutlined />}
              className="fade-in-right"
              style={{
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
              }}
            >
              查看详情
            </Button>
            <Button 
              icon={<SettingOutlined />}
              className="fade-in-right"
              style={{
                borderRadius: '8px',
                animationDelay: '0.1s'
              }}
            >
              管理实例
            </Button>
          </Space>
        }
        className="content-card fade-in-up"
        style={{
          animationDelay: '0.4s'
        }}
      >
        <Table
          columns={columns}
          dataSource={instanceData}
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