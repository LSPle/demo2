import React, { useState } from 'react';
import { Card, Select, Button, Space, Table, Alert, Tabs, Input, message } from 'antd';
import {
  PlayCircleOutlined,
  SaveOutlined,
  ClearOutlined,
  HistoryOutlined,
  DownloadOutlined,
  DatabaseOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const SQLConsole = () => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [sqlQuery, setSqlQuery] = useState('-- 请输入SQL语句\nSELECT * FROM users LIMIT 10;');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);
  const [queryHistory, setQueryHistory] = useState([
    {
      id: 1,
      query: 'SELECT COUNT(*) FROM users WHERE status = "active"',
      executionTime: '0.05s',
      timestamp: '2023-06-20 14:30:25',
      status: 'success'
    },
    {
      id: 2,
      query: 'SELECT u.name, p.title FROM users u JOIN posts p ON u.id = p.user_id',
      executionTime: '0.12s',
      timestamp: '2023-06-20 14:25:10',
      status: 'success'
    },
    {
      id: 3,
      query: 'UPDATE users SET last_login = NOW() WHERE id = 123',
      executionTime: '0.03s',
      timestamp: '2023-06-20 14:20:45',
      status: 'error'
    }
  ]);

  // 数据库实例选项
  const instanceOptions = [
    { value: 'mysql-prod', label: '主数据库-生产环境', type: 'MySQL' },
    { value: 'mysql-slave', label: '从数据库-生产环境', type: 'MySQL' },
    { value: 'redis-cluster', label: 'Redis缓存集群', type: 'Redis' },
    { value: 'mongodb-log', label: 'MongoDB-日志数据库', type: 'MongoDB' }
  ];

  // 模拟查询结果
  const mockQueryResults = {
    columns: [
      { title: 'ID', dataIndex: 'id', key: 'id' },
      { title: '用户名', dataIndex: 'username', key: 'username' },
      { title: '邮箱', dataIndex: 'email', key: 'email' },
      { title: '状态', dataIndex: 'status', key: 'status' },
      { title: '创建时间', dataIndex: 'created_at', key: 'created_at' }
    ],
    data: [
      {
        key: '1',
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        status: 'active',
        created_at: '2023-01-15 10:30:00'
      },
      {
        key: '2',
        id: 2,
        username: 'user001',
        email: 'user001@example.com',
        status: 'active',
        created_at: '2023-02-20 14:25:30'
      },
      {
        key: '3',
        id: 3,
        username: 'user002',
        email: 'user002@example.com',
        status: 'inactive',
        created_at: '2023-03-10 09:15:45'
      }
    ],
    executionTime: '0.08s',
    rowCount: 3,
    affectedRows: 0
  };

  const handleExecuteSQL = () => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }
    
    if (!sqlQuery.trim()) {
      message.warning('请输入SQL语句');
      return;
    }

    setIsExecuting(true);
    
    // 模拟执行过程
    setTimeout(() => {
      setExecutionResults(mockQueryResults);
      setIsExecuting(false);
      
      // 添加到历史记录
      const newHistoryItem = {
        id: Date.now(),
        query: sqlQuery.trim(),
        executionTime: mockQueryResults.executionTime,
        timestamp: new Date().toLocaleString('zh-CN'),
        status: 'success'
      };
      setQueryHistory([newHistoryItem, ...queryHistory]);
      
      message.success('SQL执行成功');
    }, 1000);
  };

  const handleClearEditor = () => {
    setSqlQuery('');
    setExecutionResults(null);
  };

  const handleSaveQuery = () => {
    message.success('SQL语句已保存');
  };

  const handleLoadHistory = (historyItem) => {
    setSqlQuery(historyItem.query);
    message.info('已加载历史查询');
  };

  const handleExportResults = () => {
    message.success('查询结果已导出');
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1>SQL窗口</h1>
        <p>执行和调试SQL语句的交互式窗口</p>
      </div>

      {/* 工具栏 */}
      <Card className="content-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <span style={{ fontWeight: 500 }}>数据库实例:</span>
            <Select
              placeholder="请选择实例"
              style={{ width: 250 }}
              value={selectedInstance}
              onChange={setSelectedInstance}
            >
              {instanceOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  <DatabaseOutlined style={{ marginRight: 8 }} />
                  {option.label}
                </Option>
              ))}
            </Select>
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>1行 0字符</span>
          </Space>
          
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleExecuteSQL}
              loading={isExecuting}
              disabled={!selectedInstance}
            >
              执行
            </Button>
            <Button icon={<SaveOutlined />} onClick={handleSaveQuery}>
              保存
            </Button>
            <Button icon={<ClearOutlined />} onClick={handleClearEditor}>
              清空
            </Button>
            <Button icon={<HistoryOutlined />}>
              格式化
            </Button>
          </Space>
        </div>
      </Card>

      {/* SQL编辑器和结果区域 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, height: 'calc(100vh - 300px)' }}>
        {/* SQL编辑器 */}
        <Card title="SQL编辑器" className="content-card">
          <TextArea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            placeholder="请输入SQL语句..."
            style={{
              height: '100%',
              fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
              fontSize: 13,
              lineHeight: 1.6,
              resize: 'none'
            }}
          />
        </Card>

        {/* 结果和历史 */}
        <Card className="content-card" style={{ height: '100%' }}>
          <Tabs defaultActiveKey="results" style={{ height: '100%' }}>
            <TabPane tab="执行结果" key="results">
              {isExecuting ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 16 }} />
                  <div>正在执行SQL语句...</div>
                </div>
              ) : executionResults ? (
                <div>
                  <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Alert
                      message={`查询成功，返回 ${executionResults.rowCount} 行记录，执行时间: ${executionResults.executionTime}`}
                      type="success"
                      showIcon
                      style={{ flex: 1, marginRight: 16 }}
                    />
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleExportResults}
                    >
                      导出
                    </Button>
                  </div>
                  <Table
                    columns={executionResults.columns}
                    dataSource={executionResults.data}
                    size="small"
                    pagination={false}
                    scroll={{ y: 300 }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  执行SQL语句后将显示结果
                </div>
              )}
            </TabPane>
            
            <TabPane tab="查询历史" key="history">
              <div style={{ height: 400, overflowY: 'auto' }}>
                {queryHistory.map(item => (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      border: '1px solid #f0f0f0',
                      borderRadius: 6,
                      marginBottom: 8,
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onClick={() => handleLoadHistory(item)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#fafafa';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                      fontSize: 12,
                      marginBottom: 8,
                      color: '#262626'
                    }}>
                      {item.query}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: '#8c8c8c' }}>
                        {item.timestamp} • {item.executionTime}
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: item.status === 'success' ? '#52c41a' : '#ff4d4f'
                      }}>
                        {item.status === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default SQLConsole;