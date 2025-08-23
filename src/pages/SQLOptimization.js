import React, { useState, useEffect } from 'react';
import { Card, Select, Input, Button, Alert, message, Typography } from 'antd';
import {
  DatabaseOutlined,
  CodeOutlined,
  BulbOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';

const { TextArea } = Input;
const { Option } = Select;
const { Paragraph } = Typography;

// 新增：格式化分析文本的渲染函数
const renderAnalysis = (text) => {
  const lines = (text || '').split('\n');
  const blocks = [];
  let currentList = [];
  let key = 0;

  const flushList = () => {
    if (currentList.length) {
      blocks.push(
        <ul key={`list-${key++}`} style={{ paddingLeft: 18, marginBottom: 8 }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ lineHeight: 1.8 }}>{item}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) return;

    // 小标题（支持形如【标题】或 Markdown # 标题）
    if ((line.startsWith('【') && line.endsWith('】')) || /^#{1,6}\s/.test(line)) {
      flushList();
      blocks.push(
        <div key={`h-${key++}`} style={{ fontWeight: 600, marginTop: 8, marginBottom: 6 }}>
          {line.replace(/^#{1,6}\s*/, '')}
        </div>
      );
      return;
    }

    // 项目符号列表
    if (/^-\s+/.test(line) || /^[•·]\s+/.test(line)) {
      currentList.push(line.replace(/^-\s+|^[•·]\s+/, ''));
      return;
    }

    // 普通段落
    flushList();
    blocks.push(
      <Paragraph key={`p-${key++}`} style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
        {line}
      </Paragraph>
    );
  });

  flushList();
  return <div>{blocks}</div>;
};

const SQLOptimization = () => {
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [sqlQuery, setSqlQuery] = useState('');
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 数据库实例选项
  const [instanceOptions, setInstanceOptions] = useState([]);
  // 数据库选项
  const [databaseOptions, setDatabaseOptions] = useState([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);

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
            label: `${inst.instanceName} (${inst.dbType}) ${inst.host}:${inst.port}`
          }));
        setInstanceOptions(options);
      } catch (err) {
        console.error('获取实例列表失败:', err);
        message.error('获取数据库实例列表失败，请检查后端服务');
        setInstanceOptions([]);
      }
    };
    fetchInstances();
  }, []);

  // 当选择实例时，获取该实例的数据库列表
  useEffect(() => {
    if (selectedInstance) {
      fetchDatabases(selectedInstance);
    } else {
      setDatabaseOptions([]);
      setSelectedDatabase('');
    }
  }, [selectedInstance]);

  const fetchDatabases = async (instanceId) => {
    setLoadingDatabases(true);
    try {
      const response = await fetch(API_ENDPOINTS.INSTANCE_DATABASES(instanceId));
      if (!response.ok) {
        if (response.status === 400) {
          const errorData = await response.json();
          message.warning(errorData.error || '该实例类型不支持数据库列表');
          setDatabaseOptions([]);
          return;
        }
        throw new Error('获取数据库列表失败');
      }
      const data = await response.json();
      const databases = data.databases || [];
      setDatabaseOptions(databases.map(db => ({ value: db, label: db })));
      
      // 如果只有一个数据库，自动选择
      if (databases.length === 1) {
        setSelectedDatabase(databases[0]);
      } else {
        setSelectedDatabase('');
      }
    } catch (err) {
      console.error('获取数据库列表失败:', err);
      message.error('获取数据库列表失败，请检查实例连接状态');
      setDatabaseOptions([]);
    } finally {
      setLoadingDatabases(false);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedInstance) {
      message.warning('请选择实例');
      return;
    }
    if (!selectedDatabase) {
      message.warning('请选择数据库');
      return;
    }
    if (!sqlQuery.trim()) {
      message.warning('请输入SQL语句');
      return;
    }

    setIsAnalyzing(true);
    try {
      const payload = { 
        instanceId: Number(selectedInstance), 
        sql: sqlQuery.trim(),
        database: selectedDatabase
      };

      const resp = await fetch(API_ENDPOINTS.SQL_ANALYZE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!resp.ok) {
        const errorData = await resp.json();
        throw new Error(errorData.error || '分析接口返回错误');
      }
      
      const data = await resp.json();
      const rewritten = data?.rewrittenSql || null;
      const analysis = data?.analysis || null;
      
      setOptimizationResults({
        originalQuery: sqlQuery,
        optimizedQuery: rewritten || sqlQuery,
        hasOptimization: !!rewritten && rewritten !== sqlQuery,
        analysis
      });
    } catch (e) {
      console.error(e);
      message.error(`分析失败：${e.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedInstance('');
    setSelectedDatabase('');
    setSqlQuery('');
    setOptimizationResults(null);
    setDatabaseOptions([]);
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1>SQL审核优化</h1>
        <p>选择实例和数据库，对SQL语句进行审核优化</p>
      </div>

      {/* 主要内容区域 */}
      <Card className="content-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* 实例选择 */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              数据库实例 <span style={{ color: '#ff4d4f' }}>*</span>
            </label>
            <Select
              placeholder="请选择数据库实例"
              style={{ width: '100%' }}
              value={selectedInstance}
              onChange={setSelectedInstance}
              notFoundContent="暂无可用实例"
            >
              {instanceOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </div>

          {/* 数据库选择 */}
          {selectedInstance && (
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                <CodeOutlined style={{ marginRight: 8 }} />
                数据库 <span style={{ color: '#ff4d4f' }}>*</span>
              </label>
              <Select
                placeholder={loadingDatabases ? "正在加载数据库列表..." : "请选择数据库"}
                style={{ width: '100%' }}
                value={selectedDatabase}
                onChange={setSelectedDatabase}
                loading={loadingDatabases}
                notFoundContent={loadingDatabases ? "加载中..." : "暂无可用数据库"}
              >
                {databaseOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
              <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
                选择数据库可以提供更精确的优化建议
              </div>
            </div>
          )}

          {/* SQL输入 */}
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              SQL 语句 <span style={{ color: '#ff4d4f' }}>*</span>
            </label>
            <TextArea
              rows={6}
              placeholder="请输入需要分析的SQL语句"
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
            />
            <div style={{ marginTop: 4, color: '#8c8c8c', fontSize: 12 }}>
              支持SELECT/INSERT/UPDATE/DELETE等语句
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <Button type="primary" onClick={handleAnalyze} loading={isAnalyzing}>
              开始分析
            </Button>
            <Button onClick={handleReset} disabled={isAnalyzing}>重置</Button>
          </div>

          {/* 分析结果 */}
          {optimizationResults && (
            <Card type="inner" title={<span><BulbOutlined style={{ marginRight: 8 }} />分析结果</span>}
                  style={{ marginTop: 16 }}>
              {optimizationResults.analysis ? (
                <Alert
                  message="分析与建议"
                  description={renderAnalysis(optimizationResults.analysis)}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              ) : (
                <Alert message="未获得详细分析（可能为降级输出，仅尝试了SQL重写）" type="warning" showIcon style={{ marginBottom: 16 }} />
              )}

              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 6, fontWeight: 500 }}>建议SQL</div>
                <Paragraph copyable style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                  {optimizationResults.optimizedQuery}
                </Paragraph>
              </div>
            </Card>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SQLOptimization;