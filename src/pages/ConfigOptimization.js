import React, { useState } from 'react';
import { Card, Select, Table, Button, Space, Tag, Progress, Alert, Tabs, Descriptions, Input, message } from 'antd';
import {
  DatabaseOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  EditOutlined,
  SaveOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { TabPane } = Tabs;
const { TextArea } = Input;

const ConfigOptimization = () => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [configData, setConfigData] = useState(null);
  const [editingConfig, setEditingConfig] = useState({});

  // 数据库实例选项
  const instanceOptions = [
    { value: 'mysql-prod', label: '主数据库-生产环境', type: 'MySQL 8.0' },
    { value: 'mysql-slave', label: '从数据库-生产环境', type: 'MySQL 8.0' },
    { value: 'redis-cluster', label: 'Redis缓存集群', type: 'Redis 6.2' },
    { value: 'mongodb-log', label: 'MongoDB-日志数据库', type: 'MongoDB 5.0' }
  ];

  // 模拟配置数据
  const mockConfigData = {
    basicInfo: {
      instanceName: '主数据库-生产环境',
      version: 'MySQL 8.0.28',
      uptime: '45天 12小时 30分钟',
      connections: '156/1000',
      memoryUsage: '68%',
      diskUsage: '45%'
    },
    configItems: [
      {
        key: '1',
        category: '连接配置',
        parameter: 'max_connections',
        currentValue: '1000',
        recommendedValue: '1500',
        status: 'warning',
        description: '最大连接数设置',
        impact: '中等',
        reason: '当前连接使用率较高，建议适当增加最大连接数'
      },
      {
        key: '2',
        category: '缓存配置',
        parameter: 'innodb_buffer_pool_size',
        currentValue: '8G',
        recommendedValue: '12G',
        status: 'error',
        description: 'InnoDB缓冲池大小',
        impact: '高',
        reason: '缓冲池大小不足，影响查询性能'
      },
      {
        key: '3',
        category: '日志配置',
        parameter: 'slow_query_log',
        currentValue: 'OFF',
        recommendedValue: 'ON',
        status: 'warning',
        description: '慢查询日志开关',
        impact: '低',
        reason: '建议开启慢查询日志以便性能监控'
      },
      {
        key: '4',
        category: '缓存配置',
        parameter: 'query_cache_size',
        currentValue: '256M',
        recommendedValue: '256M',
        status: 'success',
        description: '查询缓存大小',
        impact: '无',
        reason: '当前配置合理'
      },
      {
        key: '5',
        category: '连接配置',
        parameter: 'wait_timeout',
        currentValue: '28800',
        recommendedValue: '3600',
        status: 'warning',
        description: '连接超时时间',
        impact: '中等',
        reason: '超时时间过长，可能导致连接资源浪费'
      }
    ],
    optimizationSummary: {
      totalItems: 5,
      needOptimization: 3,
      highImpact: 1,
      mediumImpact: 2,
      lowImpact: 1,
      score: 72
    }
  };

  const handleInstanceChange = (value) => {
    setSelectedInstance(value);
    setConfigData(null);
  };

  const handleAnalyzeConfig = () => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }

    setIsAnalyzing(true);
    
    // 模拟分析过程
    setTimeout(() => {
      setConfigData(mockConfigData);
      setIsAnalyzing(false);
      message.success('配置分析完成');
    }, 2000);
  };

  const handleEditConfig = (record) => {
    setEditingConfig({
      ...editingConfig,
      [record.key]: record.recommendedValue
    });
  };

  const handleSaveConfig = (record) => {
    message.success(`参数 ${record.parameter} 已更新`);
    setEditingConfig({
      ...editingConfig,
      [record.key]: undefined
    });
  };

  const handleApplyAllOptimizations = () => {
    message.success('所有优化建议已应用');
  };

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
      render: (text, record) => {
        const isEditing = editingConfig[record.key] !== undefined;
        return isEditing ? (
          <Input
            size="small"
            value={editingConfig[record.key]}
            onChange={(e) => setEditingConfig({
              ...editingConfig,
              [record.key]: e.target.value
            })}
            style={{ width: 100 }}
          />
        ) : (
          <code style={{ 
            backgroundColor: record.status === 'success' ? '#f6ffed' : '#fff2e8', 
            padding: '2px 6px', 
            borderRadius: 4,
            color: record.status === 'success' ? '#52c41a' : '#fa8c16'
          }}>
            {text}
          </code>
        );
      }
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
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const isEditing = editingConfig[record.key] !== undefined;
        return (
          <Space size="small">
            {isEditing ? (
              <Button
                size="small"
                type="primary"
                icon={<SaveOutlined />}
                onClick={() => handleSaveConfig(record)}
              >
                保存
              </Button>
            ) : (
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEditConfig(record)}
                disabled={record.status === 'success'}
              >
                编辑
              </Button>
            )}
          </Space>
        );
      }
    }
  ];

  return (
    <div>
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
                style={{ width: 300 }}
                value={selectedInstance}
                onChange={handleInstanceChange}
              >
                {instanceOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    <DatabaseOutlined style={{ marginRight: 8 }} />
                    {option.label}
                    <span style={{ color: '#8c8c8c', marginLeft: 8 }}>({option.type})</span>
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
                <Descriptions.Item label="版本">{configData.basicInfo.version}</Descriptions.Item>
                <Descriptions.Item label="运行时间">{configData.basicInfo.uptime}</Descriptions.Item>
              </Descriptions>
              
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>连接数</span>
                    <span>{configData.basicInfo.connections}</span>
                  </div>
                  <Progress percent={15.6} size="small" />
                </div>
                
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>内存使用</span>
                    <span>{configData.basicInfo.memoryUsage}</span>
                  </div>
                  <Progress percent={68} size="small" status="active" />
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>磁盘使用</span>
                    <span>{configData.basicInfo.diskUsage}</span>
                  </div>
                  <Progress percent={45} size="small" />
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

          {/* 配置详情 */}
          <Card 
            title="配置参数详情" 
            className="content-card"
            extra={
              <Button 
                type="primary" 
                icon={<SettingOutlined />}
                onClick={handleApplyAllOptimizations}
              >
                应用所有优化
              </Button>
            }
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