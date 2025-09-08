import React, { useEffect, useMemo, useState } from 'react';
import { Card, Select, Table, Form, Input, DatePicker, Space, Button, Tag, message, Tooltip, Modal } from 'antd';
import API_BASE_URL, { API_ENDPOINTS } from '../config/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

const SlowQueryLogs = () => {
  const [instances, setInstances] = useState([]);
  const [instanceId, setInstanceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0, overview: {} });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState({ keyword: '', db: '', user_host: '', range: [] });
  const [sqlPreview, setSqlPreview] = useState({ open: false, sql: '' });

  // 加载实例列表
  useEffect(() => {
    fetch(`${API_BASE_URL}${API_ENDPOINTS.INSTANCES}`)
      .then(res => res.json())
      .then(json => {
        const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        setInstances(list);
      })
      .catch(() => {});
  }, []);

  const fetchSlowLogs = async (id, p = page, ps = pageSize, f = filters) => {
    if (!id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('page_size', String(ps));
      if (f.keyword) params.set('keyword', f.keyword);
      if (f.db) params.set('db', f.db);
      if (f.user_host) params.set('user_host', f.user_host);
      if (Array.isArray(f.range) && f.range.length === 2) {
        params.set('start_time', f.range[0].toISOString());
        params.set('end_time', f.range[1].toISOString());
      }
      const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SLOWLOG_LIST(id)}?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        // 若后端返回 overview 但报错（比如 FILE 输出），给出提示
        if (json?.overview && String(json?.error || '').includes('TABLE')) {
          message.error('仅支持 log_output=TABLE 的实例，当前实例不满足');
        } else {
          message.error(json?.error || '查询失败');
        }
        setData({ items: [], total: 0, overview: json?.overview || {} });
        return;
      }
      setData(json);
    } catch (e) {
      message.error('请求失败');
    } finally {
      setLoading(false);
    }
  };

  // 实例变化时重置分页并拉取
  useEffect(() => {
    if (instanceId) {
      setPage(1);
      fetchSlowLogs(instanceId, 1, pageSize, filters);
    }
  }, [instanceId]);

  const columns = useMemo(() => [
    {
      title: '查询时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      sorter: (a, b) => {
        const timeA = a.start_time ? new Date(a.start_time).getTime() : 0;
        const timeB = b.start_time ? new Date(b.start_time).getTime() : 0;
        return timeA - timeB;
      },
      render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '用户和主机',
      dataIndex: 'user_host',
      key: 'user_host',
      width: 220,
      ellipsis: true,
      render: (text) => <Tooltip title={text}>{text}</Tooltip>
    },
    {
      title: '查询语句',
      dataIndex: 'sql_text',
      key: 'sql_text',
      width: 550,
      ellipsis: true,
      render: (text) => {
        const SqlTextCell = ({ sql }) => {
          const [showViewAll, setShowViewAll] = useState(false);
          const textRef = React.useRef(null);

          React.useEffect(() => {
            if (textRef.current && sql) {
              // 检查文本是否超出容器宽度
              const isOverflowing = textRef.current.scrollWidth > textRef.current.clientWidth;
              setShowViewAll(isOverflowing);
            }
          }, [sql]);

          return (
            <div style={{ position: 'relative', maxWidth: 530 }}>
              <div 
                ref={textRef}
                style={{ 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  paddingRight: showViewAll ? '70px' : '0' // 为按钮预留空间
                }}
              >
                <Tooltip title={sql}>{sql}</Tooltip>
              </div>
              {showViewAll && (
                <Button 
                  type="link" 
                  size="small" 
                  style={{ 
                    position: 'absolute',
                    right: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    padding: '0 4px',
                    height: 'auto',
                    lineHeight: '1.2',
                    fontSize: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    zIndex: 1
                  }} 
                  onClick={() => setSqlPreview({ open: true, sql })}
                >
                  查看全部
                </Button>
              )}
            </div>
          );
        };

        return <SqlTextCell sql={text} />;
      }
    },
    {
      title: '执行时长',
      dataIndex: 'query_time',
      key: 'query_time',
      width: 120,
      sorter: (a, b) => parseFloat(a.query_time || 0) - parseFloat(b.query_time || 0),
      render: (v) => `${v}s`
    },
    {
      title: '返回行数',
      dataIndex: 'rows_sent',
      key: 'rows_sent',
      width: 110,
      sorter: (a, b) => parseInt(a.rows_sent || 0) - parseInt(b.rows_sent || 0)
    },
    {
      title: '锁等待时间',
      dataIndex: 'lock_time',
      key: 'lock_time',
      width: 120,
      sorter: (a, b) => parseFloat(a.lock_time || 0) - parseFloat(b.lock_time || 0),
      render: (v) => `${v}s`
    },
    {
      title: '扫描行数',
      dataIndex: 'rows_examined',
      key: 'rows_examined',
      width: 120,
      sorter: (a, b) => parseInt(a.rows_examined || 0) - parseInt(b.rows_examined || 0)
    }
  ], [setSqlPreview]);

  const onSearch = () => {
    setPage(1);
    fetchSlowLogs(instanceId, 1, pageSize, filters);
  };

  const onReset = () => {
    const nf = { keyword: '', db: '', user_host: '', range: [] };
    setFilters(nf);
    setPage(1);
    fetchSlowLogs(instanceId, 1, pageSize, nf);
  };

  return (
    <div style={{ padding: '12px 8px' }}>
      <Card title="慢查询日志">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span>目标实例：</span>
            <Select
              style={{ width: 320 }}
              placeholder="请选择实例"
              options={instances.map(i => ({ value: i.id, label: `${i.instanceName} (${i.host}:${i.port})` }))}
              value={instanceId}
              onChange={setInstanceId}
              showSearch
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
            {data?.overview?.log_output && (
              <Tag color={String(data.overview.log_output).toUpperCase().includes('TABLE') ? 'green' : 'red'}>
                log_output: {data.overview.log_output}
              </Tag>
            )}
          </div>

          {/* 筛选 */}
          <Form layout="inline" onFinish={onSearch} style={{ gap: 12, flexWrap: 'wrap' }}>
            <Form.Item label="关键字">
              <Input
                placeholder="SQL包含..."
                allowClear
                style={{ width: 220 }}
                value={filters.keyword}
                onChange={e => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="库名">
              <Input
                placeholder="db 名称"
                allowClear
                style={{ width: 160 }}
                value={filters.db}
                onChange={e => setFilters(prev => ({ ...prev, db: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="用户/主机">
              <Input
                placeholder="User@Host"
                allowClear
                style={{ width: 200 }}
                value={filters.user_host}
                onChange={e => setFilters(prev => ({ ...prev, user_host: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="时间范围">
              <RangePicker
                showTime
                value={filters.range}
                onChange={(v) => setFilters(prev => ({ ...prev, range: v || [] }))}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" disabled={!instanceId}>查询</Button>
                <Button onClick={onReset}>重置</Button>
              </Space>
            </Form.Item>
          </Form>

          {/* 表格 */}
          <Table
            rowKey={(r, idx) => `${r.start_time}-${idx}`}
            columns={columns}
            loading={loading}
            dataSource={data.items}
            pagination={{
              current: page,
              pageSize,
              total: data.total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
                fetchSlowLogs(instanceId, p, ps, filters);
              }
            }}
          />
        </Space>
      </Card>

      <Modal open={sqlPreview.open} title="完整SQL" footer={null} onCancel={() => setSqlPreview({ open: false, sql: '' })} width={800}>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{sqlPreview.sql}</pre>
      </Modal>
    </div>
  );
};

export default SlowQueryLogs;