import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, Select, Button, Space, Table, Alert, Tabs, Input, message, Tree, Modal, Descriptions, Empty, Spin, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  DatabaseOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  RightOutlined,
  TableOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';
const { TextArea } = Input;
const { Option } = Select;

const SQLConsole = () => {
  // 实例与数据库/表
  const [instanceOptions, setInstanceOptions] = useState([]);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedDatabase, setSelectedDatabase] = useState('');
  const [treeData, setTreeData] = useState([]); // [{title, key, children, isLeaf, type: 'db'|'table', database, tableName}]
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [dbListError, setDbListError] = useState('');
  /* compact mode removed */
  /* single expand removed */
  const [expandedKeys, setExpandedKeys] = useState([]); // 受控展开键
  const treeHeight = 'calc(100vh - 280px)'; // 树区域高度与卡片高度保持一致
  const leftCardRef = useRef(null);

  // 缺失的状态补齐
  const [sqlQuery, setSqlQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState(null);
  const [queryHistory, setQueryHistory] = useState([]);
  const [schemaVisible, setSchemaVisible] = useState(false);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaData, setSchemaData] = useState(null);

  // 加载实例列表
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.INSTANCES);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '获取实例列表失败');
        const list = Array.isArray(data) ? data : (Array.isArray(data.instances) ? data.instances : []);
        const options = list.map((inst) => ({
          value: String(inst.id),
          label: `${inst.instanceName} (${inst.dbType}) ${inst.host}:${inst.port}`
        }));
        setInstanceOptions(options);
      } catch (e) {
        console.error(e);
        setInstanceOptions([]);
        message.error(`获取实例列表失败：${e.message}`);
      }
    };
    fetchInstances();
  }, []);


  const fetchDatabases = async (instId) => {
    if (!instId) return;
    try {
      setDbListError('');
      setLoadingDatabases(true);
      const res = await fetch(API_ENDPOINTS.INSTANCE_DATABASES(instId));
      const data = await res.json();
      if (!res.ok) {
        const msg = data?.error || '获取数据库列表失败';
        setDbListError(msg);
        throw new Error(msg);
      }
      const dbs = Array.isArray(data?.databases) ? data.databases : (Array.isArray(data) ? data : []);
      const nodes = dbs.map(db => ({
        title: renderDbTitle(db),
        key: `${instId}::${db}`,
        isLeaf: false,
        type: 'db',
        database: db,
      }));
      setTreeData(nodes);
      // 默认展开首个非系统库，系统库默认折叠
      const firstNonSystem = nodes.find(n => !isSystemDb(n.database));
      if (firstNonSystem) {
        setExpandedKeys([firstNonSystem.key]);
      } else {
        setExpandedKeys([]);
      }
      setSelectedDatabase('');
    } catch (e) {
      console.error(e);
      message.error(`获取数据库列表失败：${e.message}`);
      setTreeData([]);
      setExpandedKeys([]);
    } finally {
      setLoadingDatabases(false);
    }
  };
  useEffect(() => {
    fetchDatabases(selectedInstance);
  }, [selectedInstance]);

  // 懒加载表列表
  const onLoadData = ({ key, type, database, children }) => {
    if (type === 'db' && !children) {
      return new Promise(async (resolve) => {
        try {
          const res = await fetch(API_ENDPOINTS.DATABASE_TABLES(selectedInstance, database));
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || '获取数据表失败');
          const tables = Array.isArray(data.tables) ? data.tables : [];
          const tableNodes = tables.map(t => ({
            title: renderTableTitle(database, t),
            key: `${selectedInstance}::${database}::${t}`,
            isLeaf: true,
            type: 'table',
            database,
            tableName: t
          }));
          setTreeData(origin => updateTreeData(origin, key, tableNodes));
        } catch (e) {
          console.error(e);
          message.error(`获取数据表失败：${e.message}`);
        } finally {
          resolve();
        }
      });
    }
    return Promise.resolve();
  };

  const updateTreeData = (list, key, children) =>
    list.map(node => {
      if (node.key === key) {
        return { ...node, children };
      }
      if (node.children) {
        return { ...node, children: updateTreeData(node.children, key, children) };
      }
      return node;
    });

  // 受控展开：去除单路展开逻辑，保持默认行为
  const onExpand = (keys) => {
    setExpandedKeys(keys);
  };

  // 数据库节点标题渲染 & 系统库识别
  const isSystemDb = (name) => {
    const n = String(name || '').toLowerCase();
    return n === 'information_schema' || n === 'performance_schema' || n === 'mysql' || n === 'sys';
  };

  const renderDbTitle = (db) => (
    <div className="db-tree-node" aria-label={`数据库 ${db}`}>
      <DatabaseOutlined className={`db-icon ${isSystemDb(db) ? 'system' : ''}`} />
      <Tooltip title={db} placement="right">
        <span className={`db-name ${isSystemDb(db) ? 'system' : ''}`}>{db}</span>
      </Tooltip>
      {isSystemDb(db) && (
        <span className="db-tag" aria-label="系统库">系统</span>
      )}
    </div>
  );

  const renderTableTitle = (db, table) => (
    <div className="db-tree-node" aria-label={`数据表 ${db}.${table}`} style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        <TableOutlined style={{ color: '#6c8cff', marginRight: 6 }} />
        <Tooltip title={`${db}.${table}`} placement="right">
          <span className="table-name" style={{ minWidth: 0 }}>{table}</span>
        </Tooltip>
      </div>
      <a
        onClick={(e) => {
          e.stopPropagation();
          handleShowSchema(db, table);
        }}
        style={{ fontSize: 12 }}
        title="查看表结构"
        aria-label={`查看 ${db}.${table} 的表结构`}
      >
        <InfoCircleOutlined style={{ marginRight: 4 }} />结构
      </a>
    </div>
  );

  const handleTreeSelect = (selectedKeys, info) => {
    const node = info?.node;
    if (!node) return;
    if (node.type === 'db') {
      setSelectedDatabase(node.database);
    }
    if (node.type === 'table') {
      const db = node.database;
      const t = node.tableName;
      setSelectedDatabase(db);
      const baseSql = `SELECT * FROM \`${db}\`.\`${t}\` LIMIT 100;`;
      setSqlQuery(baseSql);
      message.info(`已生成查询: ${db}.${t}`);
    }
  };

  const handleShowSchema = async (db, table) => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }
    try {
      setSchemaVisible(true);
      setSchemaLoading(true);
      setSchemaData(null);
      const res = await fetch(API_ENDPOINTS.TABLE_SCHEMA(selectedInstance, db, table));
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '获取表结构失败');
      const raw = data.schema || {};
      // 统一字段命名，填充必需信息
      const normalized = {
        tableName: raw.table_name || raw.tableName || table,
        database: db,
        dataLength: raw.data_length ?? raw.dataLength ?? null,
        indexLength: raw.index_length ?? raw.indexLength ?? null,
        tableRows: raw.table_rows_approx ?? raw.row_count_estimate ?? raw.tableRows ?? null,
        createTime: raw.create_time ?? raw.createTime ?? null,
        updateTime: raw.update_time ?? raw.updateTime ?? null,
        engine: raw.engine ?? null,
        tableCollation: raw.table_collation ?? raw.tableCollation ?? null,
        avgRowLength: raw.avg_row_length ?? raw.avgRowLength ?? null,
        primaryKey: raw.primary_key ?? raw.primaryKey ?? [],
        columns: Array.isArray(raw.columns) ? raw.columns : [],
        indexes: Array.isArray(raw.indexes) ? raw.indexes : [],
        constraints: Array.isArray(raw.constraints) ? raw.constraints : []
      };
      setSchemaData(normalized);
    } catch (e) {
      console.error(e);
      message.error(`获取表结构失败：${e.message}`);
    } finally {
      setSchemaLoading(false);
    }
  };

  // 执行 SQL
  const handleExecuteSQL = async () => {
    if (!selectedInstance) {
      message.warning('请先选择数据库实例');
      return;
    }
    if (!selectedDatabase) {
      message.warning('请在左侧选择数据库');
      return;
    }
    if (!sqlQuery.trim()) {
      message.warning('请输入SQL语句');
      return;
    }

    setIsExecuting(true);
    const start = Date.now();
    try {
      const res = await fetch(API_ENDPOINTS.SQL_EXECUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId: Number(selectedInstance), sql: sqlQuery, database: selectedDatabase, maxRows: 1000 })
      });
      const data = await res.json();
      const elapsed = Date.now() - start;
      if (!res.ok) throw new Error(data?.error || '执行失败');

      if (data.sqlType === 'query') {
        const columns = (data.columns || []).map(col => ({ title: col, dataIndex: col, key: col }));
        const rows = Array.isArray(data.rows) ? data.rows.map((r, idx) => ({ key: String(idx), ...r })) : [];
        setExecutionResults({ columns, data: rows, rowCount: data.rowCount ?? rows.length, executionTime: `${elapsed}ms` });
        message.success('SQL执行成功');
        appendHistory({ query: sqlQuery.trim(), status: 'success', rowCount: rows.length, execMs: elapsed });
      } else {
        setExecutionResults({
          columns: [{ title: '结果', dataIndex: 'msg', key: 'msg' }],
          data: [{ key: '1', msg: `执行成功，影响行数：${data.affectedRows}` }],
          rowCount: 0,
          executionTime: `${elapsed}ms`,
          nonQuery: { affectedRows: data.affectedRows }
        });
        message.success(`执行成功，影响行数：${data.affectedRows}`);
        appendHistory({ query: sqlQuery.trim(), status: 'success', rowCount: 0, execMs: elapsed });
      }
    } catch (e) {
      console.error(e);
      setExecutionResults({
        columns: [{ title: '错误', dataIndex: 'error', key: 'error' }],
        data: [{ key: '1', error: e.message }],
        rowCount: 0,
        executionTime: undefined
      });
      appendHistory({ query: sqlQuery.trim(), status: 'error', rowCount: 0, execMs: 0 });
      message.error(`执行失败：${e.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // 历史记录：加载与写入
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sql_console_history');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setQueryHistory(list);
      }
    } catch {}
  }, []);

  const appendHistory = (item) => {
    const entry = {
      id: Date.now(),
      query: item.query,
      database: selectedDatabase || '-',
      timestamp: new Date().toLocaleString('zh-CN'),
      status: item.status,
      rowCount: item.rowCount,
      execMs: item.execMs
    };
    const next = [entry, ...queryHistory].slice(0, 200);
    setQueryHistory(next);
    try { localStorage.setItem('sql_console_history', JSON.stringify(next)); } catch {}
  };

  const handleLoadHistory = (historyItem) => {
    setSqlQuery(historyItem.query);
    message.info('已加载历史查询');
  };

  const handleClearEditor = () => {
    setSqlQuery('');
    setExecutionResults(null);
  };

  // 移除了 handleSaveQuery 相关逻辑

  const handleExportResults = () => {
    if (!executionResults || !executionResults.data) {
      message.warning('无可导出的数据');
      return;
    }
    const cols = (executionResults.columns || []).map(c => c.dataIndex);
    const header = cols.join(',');
    const lines = executionResults.data.map(row => cols.map(k => formatCsvValue(row[k])).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_result_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCsvValue = (v) => {
    if (v == null) return '';
    const s = String(v).replaceAll('"', '""');
    if (/[",\n]/.test(s)) return `"${s}"`;
    return s;
  };

  const formatBytes = (bytes) => {
    if (bytes == null) return '-';
    const n = Number(bytes);
    if (Number.isNaN(n)) return String(bytes);
    if (n < 1024) return `${n} B`;
    const units = ['KB', 'MB', 'GB', 'TB'];
    let v = n / 1024;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024; i++;
    }
    return `${v.toFixed(2)} ${units[i]}`;
  };

  // 新增：格式化日期时间为 YYYY-MM-DD HH:MM:SS
  const formatDateTime = (input) => {
    if (!input) return '-';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const HH = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
  };

  // 统一渲染：表结构基础信息，使用 items API 避免 children 方式潜在重复渲染
  const renderSchemaBaseInfo = () => {
    if (!schemaData) return null;
    const baseInfoItems = [
      { key: 'tableName', label: '表名', children: schemaData.tableName },
      { key: 'database', label: '数据库', children: schemaData.database },
      { key: 'dataLength', label: '数据量', children: formatBytes(schemaData.dataLength) },
      { key: 'indexLength', label: '索引大小', children: formatBytes(schemaData.indexLength) },
      { key: 'tableRows', label: '总行数', children: schemaData.tableRows ?? '-' },
      { key: 'createTime', label: '创建时间', children: formatDateTime(schemaData.createTime) }
    ];
    return (
      <Descriptions style={{ marginBottom: 16 }} column={2} size="small" items={baseInfoItems} />
    );
  };

  // 列增强：统一对齐、NULL 显示、长文本省略与 Tooltip、数字千分位
  const enhancedColumns = useMemo(() => {
    if (!executionResults || !executionResults.columns) return [];
    const sample = (executionResults.data && executionResults.data[0]) || {};
    return executionResults.columns.map((col) => {
      const dataIndex = col.dataIndex || col.key || col.title;
      const sampleVal = sample?.[dataIndex];
      const isNum = typeof sampleVal === 'number';
      return {
        ...col,
        dataIndex,
        align: isNum ? 'right' : 'left',
        ellipsis: true,
        render: (value) => {
          if (value == null || value === '') return <span style={{ color: '#8c8c8c' }}>NULL</span>;
          if (typeof value === 'number') return value.toLocaleString();
          const str = String(value);
          if (str.length > 100) {
            return <Tooltip title={str}>{str.slice(0, 100)}…</Tooltip>;
          }
          return str;
        }
      };
    });
  }, [executionResults]);

  const lineCharHint = (() => {
    const lines = sqlQuery.split('\n').length;
    const chars = sqlQuery.length;
    return `${lines}行 ${chars}字符`;
  })();

  return (
    <div>
      {/* 工具栏 */}
      <Card className="content-card" style={{ marginBottom: 24 }}>
        <div className="toolbar-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space wrap>
            {/* 移除“数据库实例:”与行/字符统计两个span，仅保留下拉 */}
            {/* 提示文案：选择实例 */}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                color: '#303030',
                fontSize: 18,
                fontWeight: 600,
                marginRight: 8
              }}
            >
              <DatabaseOutlined style={{ color: '#722ed1' }} />
              选择实例
            </span>
            
             <Select
               placeholder="请选择实例"
               style={{ width: 360, maxWidth: '100%' }}
               value={selectedInstance}
               onChange={(val) => { setSelectedInstance(val); setTreeData([]); setSelectedDatabase(''); setExecutionResults(null); setDbListError(''); }}
               loading={!instanceOptions.length}
             >
               {instanceOptions.map(option => (
                 <Option key={option.value} value={option.value} title={option.label}>
                   <DatabaseOutlined style={{ marginRight: 8 }} />
                   <span style={{ verticalAlign: 'middle' }}>{option.label}</span>
                 </Option>
               ))}
             </Select>
          </Space>
          
          <Space wrap>
            <Tooltip title="执行 (Ctrl+Enter)">
              <Button
                type="primary"
                shape="round"
                icon={<PlayCircleOutlined />}
                onClick={handleExecuteSQL}
                loading={isExecuting}
                disabled={!selectedInstance}
              >
                执行
              </Button>
            </Tooltip>
            <Tooltip title="清空编辑器">
              <Button shape="round" icon={<ClearOutlined />} onClick={handleClearEditor}>
                清空
              </Button>
            </Tooltip>
          </Space>
        </div>
      </Card>

      {/* 左侧库表树 + 右侧编辑与结果 */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 'calc(100vh - 200px)' }}>
        {/* 左侧库表导航 */}
        <Card 
          ref={leftCardRef}
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>数据库 / 数据表</div>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => fetchDatabases(selectedInstance)}
                disabled={!selectedInstance}
                loading={loadingDatabases}
              >
                刷新
              </Button>
            </div>
          }
          className="content-card" 
          style={{ height: '100%' }}
          styles={{ body: { padding: 12, height: '100%', overflow: 'auto' } }}
        >
          {selectedInstance && treeData.length === 0 && loadingDatabases ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
              <Spin size="small" />
              <div style={{ marginTop: 8 }}>加载数据库列表...</div>
            </div>
          ) : treeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
              {selectedInstance ? (dbListError || '暂无数据库') : '请先选择实例'}
            </div>
          ) : (
            // 移格外层滚动容器，直接使用Tree的虚拟滚动
            <Tree
              className={`db-tree modern-tree`}
              showLine={false}
              blockNode
              height={treeHeight}
              itemHeight={28}
              virtual
              switcherIcon={({ expanded }) => (
                <RightOutlined className={expanded ? 'switcher-icon expanded' : 'switcher-icon'} />
              )}
              onSelect={handleTreeSelect}
              loadData={onLoadData}
              treeData={treeData}
              expandedKeys={expandedKeys}
              onExpand={onExpand}
            />
          )}
        </Card>

        {/* 右侧：编辑器 + 结果/历史 */}
        <div style={{ display: 'grid', gridTemplateRows: 'auto 1fr', gap: 12, height: '100%', minHeight: 0 }}>
          {/* SQL编辑器 */}
          <Card title={`SQL编辑器 ${selectedDatabase ? `(当前库：${selectedDatabase})` : ''}`} className="content-card" style={{ overflow: 'hidden' }} styles={{ body: { padding: 12, overflow: 'hidden' } }}>
            <TextArea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="请输入SQL语句..."
              className="sql-editor"
              rootClassName="sql-editor-root"
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleExecuteSQL(); } }}
              style={{
                height: 180,
                fontFamily: 'Fira Code, JetBrains Mono, Monaco, Menlo, Ubuntu Mono, monospace',
                fontSize: 13,
                lineHeight: 1.7,
                resize: 'none',
                backgroundColor: '#f4f8ff',
                border: '1px solid #91caff',
                borderRadius: 12,
                padding: 16,
                boxSizing: 'border-box'
              }}
            />
          </Card>

          {/* 结果和历史 */}
          <Card className="content-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} styles={{ body: { padding: 12, height: '100%', overflow: 'hidden' } }}>
                         <Tabs 
                           defaultActiveKey="results" 
                           style={{ flex: 1, minHeight: 0 }}
                           items={[
                             {
                               key: 'results',
                               label: '执行结果',
                               children: (
                                 <>
                                   {isExecuting ? (
                                     <div style={{ textAlign: 'center', padding: '40px 0' }}>
                                       <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff', marginBottom: 16 }} />
                                       <div>正在执行SQL语句...</div>
                                     </div>
                                   ) : executionResults ? (
                                     <div>
                                       <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                         <Alert
                                           message={`执行完成，${executionResults.nonQuery ? executionResults.data[0].msg : `返回 ${executionResults.rowCount} 行`}${executionResults.executionTime ? `，耗时: ${executionResults.executionTime}` : ''}`}
                                           type="success"
                                           showIcon
                                           style={{ flex: 1, minWidth: 240 }}
                                         />
                                         {!executionResults.nonQuery && (
                                           <Button size="small" icon={<DownloadOutlined />} onClick={handleExportResults}>
                                             导出
                                           </Button>
                                         )}
                                       </div>
                                       <div style={{ height: '100%', minHeight: 0 }}>
                                         <Table
                                           className="ant-table-striped"
                                           columns={enhancedColumns}
                                           dataSource={executionResults.data}
                                           size="small"
                                           bordered
                                           tableLayout="fixed"
                                           sticky
                                           rowKey={(record, index) => index}
                                           pagination={!executionResults.nonQuery ? { pageSize: 50, showSizeChanger: true, pageSizeOptions: ['20','50','100','200'], showTotal: (t) => `共 ${t} 条` } : false}
                                           scroll={{ y: 300 }}
                                           rowClassName={(_, index) => (index % 2 === 0 ? 'table-row-light' : 'table-row-dark')}
                                         />
                                       </div>
                                     </div>
                                   ) : (
                                     <Empty description="暂无执行结果" />
                                   )}
                                 </>
                               )
                             },
                             {
                               key: 'history',
                               label: '查询历史',
                               children: (
                                 <div style={{ height: '100%', overflow: 'auto' }}>
                                   {queryHistory.length === 0 ? (
                                     <Empty description="暂无查询历史" />
                                   ) : (
                                     queryHistory.map((item, index) => (
                                       <div key={index} style={{ borderBottom: '1px solid #f0f0f0', padding: '12px 0' }}>
                                         <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
                                           {item.timestamp} | {item.database}
                                         </div>
                                         <div style={{ fontFamily: 'Monaco, Menlo, Ubuntu Mono, monospace', fontSize: 12, cursor: 'pointer' }}
                                             onClick={() => setSqlQuery(item.query)}>
                                           {item.query}
                                         </div>
                                       </div>
                                     ))
                                   )}
                                 </div>
                               )
                             }
                           ]}
                         />
                       </Card>
                     </div>
                   </div>

                 {/* 表结构信息模态框 */}
                 <Modal
                   title={`表结构信息 - ${schemaData?.tableName || ''}`}
                   open={schemaVisible}
                   onCancel={() => setSchemaVisible(false)}
                   footer={null}
                   width={1000}
                 >
                   {schemaData ? (
                     <div>
                       {renderSchemaBaseInfo()}
                       <Tabs 
                         items={[
                           {
                             key: 'columns',
                             label: '字段',
                             children: (
                               <>
                                 {Array.isArray(schemaData.columns) && schemaData.columns.length ? (
                                   <Table
                                     size="small"
                                     columns={Object.keys(schemaData.columns[0]).map(k => ({ title: k, dataIndex: k, key: k }))}
                                     dataSource={schemaData.columns.map((row, idx) => ({ key: String(idx), ...row }))}
                                     pagination={{ pageSize: 10 }}
                                   />
                                 ) : (
                                   <Empty description="无字段信息" />
                                 )}
                               </>
                             )
                           },
                           {
                             key: 'indexes',
                             label: '索引',
                             children: (
                               <>
                                 {Array.isArray(schemaData.indexes) && schemaData.indexes.length ? (
                                   <Table
                                     size="small"
                                     columns={Object.keys(schemaData.indexes[0]).map(k => ({ title: k, dataIndex: k, key: k }))}
                                     dataSource={schemaData.indexes.map((row, idx) => ({ key: String(idx), ...row }))}
                                     pagination={{ pageSize: 10 }}
                                   />
                                 ) : (
                                   <Empty description="无索引信息" />
                                 )}
                               </>
                             )
                           },
                           {
                             key: 'constraints',
                             label: '约束',
                             children: (
                               <>
                                 {Array.isArray(schemaData.constraints) && schemaData.constraints.length ? (
                                   <Table
                                     size="small"
                                     columns={Object.keys(schemaData.constraints[0]).map(k => ({ title: k, dataIndex: k, key: k }))}
                                     dataSource={schemaData.constraints.map((row, idx) => ({ key: String(idx), ...row }))}
                                     pagination={{ pageSize: 10 }}
                                   />
                                 ) : (
                                   <Empty description="无约束信息" />
                                 )}
                               </>
                             )
                           }
                         ]}
                       />
                     </div>
                   ) : (
                     <Empty />
                   )}
                 </Modal>
               </div>
             );
           };
           
           export default SQLConsole;