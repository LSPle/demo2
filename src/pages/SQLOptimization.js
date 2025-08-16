import React, { useState } from 'react';
import { Card, Steps, Select, Input, Button, Alert, List, Tag, Space, Divider } from 'antd';
import {
  DatabaseOutlined,
  CodeOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;

const SQLOptimization = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [optimizationResults, setOptimizationResults] = useState(null);

  // 数据库实例选项
  const instanceOptions = [
    { value: 'mysql-prod', label: '主数据库-生产环境 (MySQL 8.0.23)' },
    { value: 'mysql-slave', label: '从数据库-生产环境 (MySQL 8.0.23)' },
    { value: 'redis-cluster', label: 'Redis缓存集群 (Redis 6.2.5)' },
    { value: 'mongodb-log', label: 'MongoDB-日志数据库 (MongoDB 5.0.3)' }
  ];

  // 模拟优化结果
  const mockOptimizationResults = {
    originalQuery: sqlQuery,
    optimizedQuery: `SELECT u.id, u.name, p.title 
FROM users u 
INNER JOIN posts p ON u.id = p.user_id 
WHERE u.status = 'active' 
AND p.created_at >= '2023-01-01' 
ORDER BY p.created_at DESC 
LIMIT 100;`,
    improvements: [
      {
        type: 'index',
        severity: 'high',
        title: '建议添加复合索引',
        description: '在 posts 表的 (user_id, created_at) 字段上创建复合索引',
        impact: '查询性能提升 85%',
        sql: 'CREATE INDEX idx_posts_user_created ON posts(user_id, created_at);'
      },
      {
        type: 'query',
        severity: 'medium',
        title: '优化 WHERE 条件顺序',
        description: '将选择性更高的条件放在前面',
        impact: '查询性能提升 15%',
        sql: null
      },
      {
        type: 'limit',
        severity: 'low',
        title: '添加 LIMIT 限制',
        description: '避免返回过多数据，建议添加合适的 LIMIT',
        impact: '减少内存使用 30%',
        sql: null
      }
    ],
    performance: {
      before: { executionTime: '2.3s', rowsExamined: 150000 },
      after: { executionTime: '0.2s', rowsExamined: 1200 }
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && selectedInstance) {
      setCurrentStep(1);
    } else if (currentStep === 1 && sqlQuery.trim()) {
      // 模拟分析过程
      setTimeout(() => {
        setOptimizationResults(mockOptimizationResults);
        setCurrentStep(2);
      }, 1500);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      high: 'red',
      medium: 'orange',
      low: 'blue'
    };
    return colors[severity] || 'default';
  };

  const getSeverityIcon = (severity) => {
    const icons = {
      high: <ExclamationCircleOutlined />,
      medium: <ClockCircleOutlined />,
      low: <BulbOutlined />
    };
    return icons[severity] || <BulbOutlined />;
  };

  const steps = [
    {
      title: '选择实例与输入SQL',
      icon: <DatabaseOutlined />
    },
    {
      title: '查看优化建议',
      icon: <BulbOutlined />
    }
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-content">
            <h3>选择数据库实例并输入SQL语句</h3>
            
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                数据库实例 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Select
                placeholder="请选择数据库实例"
                style={{ width: '100%' }}
                value={selectedInstance}
                onChange={setSelectedInstance}
              >
                {instanceOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                SQL语句 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <TextArea
                placeholder="请输入需要优化的SQL语句..."
                rows={12}
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                style={{ fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace' }}
              />
              <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
                支持SELECT、UPDATE、INSERT、DELETE等SQL语句的审核
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="step-content">
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 16, marginBottom: 16 }}>
                <CodeOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 8 }} />
                正在分析SQL语句...
              </div>
              <div style={{ color: '#8c8c8c' }}>请稍候，系统正在为您生成优化建议</div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>优化建议</h3>
            
            {/* 性能对比 */}
            <Alert
              message="优化效果预览"
              description={
                <div>
                  <div>执行时间：{optimizationResults?.performance.before.executionTime} → {optimizationResults?.performance.after.executionTime}</div>
                  <div>扫描行数：{optimizationResults?.performance.before.rowsExamined.toLocaleString()} → {optimizationResults?.performance.after.rowsExamined.toLocaleString()}</div>
                </div>
              }
              type="success"
              showIcon
              style={{ marginBottom: 24 }}
            />

            {/* 优化建议列表 */}
            <List
              header={<div style={{ fontWeight: 500 }}>优化建议详情</div>}
              dataSource={optimizationResults?.improvements || []}
              renderItem={(item, index) => (
                <List.Item>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <Tag color={getSeverityColor(item.severity)} icon={getSeverityIcon(item.severity)}>
                        {item.severity === 'high' ? '高优先级' : item.severity === 'medium' ? '中优先级' : '低优先级'}
                      </Tag>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</span>
                    </div>
                    <div style={{ color: '#595959', marginBottom: 8 }}>
                      {item.description}
                    </div>
                    <div style={{ color: '#52c41a', fontSize: 12, marginBottom: 8 }}>
                      预期效果：{item.impact}
                    </div>
                    {item.sql && (
                      <div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>建议执行的SQL：</div>
                        <div style={{
                          background: '#f5f5f5',
                          padding: 8,
                          borderRadius: 4,
                          fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
                          fontSize: 12
                        }}>
                          {item.sql}
                        </div>
                      </div>
                    )}
                  </div>
                </List.Item>
              )}
            />

            {/* 优化后的SQL */}
            <Divider>优化后的SQL语句</Divider>
            <div style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 6,
              fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace',
              fontSize: 13,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap'
            }}>
              {optimizationResults?.optimizedQuery}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1>SQL审核优化</h1>
        <p>对SQL语句进行审核优化建议</p>
      </div>

      {/* 步骤导航 */}
      <Card className="content-card" style={{ marginBottom: 24 }}>
        <Steps
          current={currentStep}
          items={steps}
        />
      </Card>

      {/* 步骤内容 */}
      <Card className="content-card">
        {renderStepContent()}
        
        {/* 操作按钮 */}
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && currentStep < 2 && (
              <Button onClick={handlePrevious}>
                上一步
              </Button>
            )}
            {currentStep === 0 && (
              <Button
                type="primary"
                onClick={handleNext}
                disabled={!selectedInstance || !sqlQuery.trim()}
              >
                下一步
              </Button>
            )}
            {currentStep === 2 && (
              <Button
                type="primary"
                onClick={() => {
                  setCurrentStep(0);
                  setSelectedInstance('');
                  setSqlQuery('');
                  setOptimizationResults(null);
                }}
              >
                重新分析
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default SQLOptimization;