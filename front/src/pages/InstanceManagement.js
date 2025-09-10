import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, message, Badge, Tooltip } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  WifiOutlined,
  DisconnectOutlined
} from '@ant-design/icons';
import { API_ENDPOINTS } from '../config/api';
import { useInstanceStatus } from '../hooks/useInstanceStatus';

const { Search } = Input;
const { Option } = Select;

const InstanceManagement = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [instanceData, setInstanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form] = Form.useForm();
  const [editingInstance, setEditingInstance] = useState(null);
  
  // 使用WebSocket实时状态管理
  const {
    instances: realtimeInstances,
    isConnected,
    lastUpdate,
    refreshAllInstances,
    refreshInstance,
    statusStats,
    reconnect
  } = useInstanceStatus();

  // 从后端获取实例数据
  const fetchInstanceData = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_ENDPOINTS.INSTANCES);
      if (!response.ok) throw new Error('API响应失败');
      const data = await response.json();
      
      // 转换后端数据格式以匹配前端展示需求
      const formattedData = data.map(instance => ({
        key: instance.id.toString(),
        id: instance.id,
        name: instance.instanceName,
        ip: `${instance.host}:${instance.port}`,
        type: instance.dbType,
        status: instance.status,
        createTime: instance.createTime,
        username: instance.username,
        password: instance.password
      }));
      
      setInstanceData(formattedData);
    } catch (error) {
      console.error('获取实例数据失败:', error);
      message.error('获取实例数据失败，请检查后端服务');
      setInstanceData([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 合并实时数据和本地数据
  const getMergedInstanceData = () => {
    if (realtimeInstances.length === 0) {
      return instanceData;
    }
    
    return instanceData.map(instance => {
      const realtimeInstance = realtimeInstances.find(rt => rt.id === instance.id);
      if (realtimeInstance) {
        return {
          ...instance,
          status: realtimeInstance.status,
          lastCheckTime: realtimeInstance.lastCheckTime,
          isMonitoring: realtimeInstance.isMonitoring,
          isRealtime: true
        };
      }
      return instance;
    });
  };
  
  // 处理实时刷新
  const handleRefreshAll = async () => {
    if (isConnected) {
      await refreshAllInstances();
      message.success('已请求刷新所有实例状态');
    } else {
      await fetchInstanceData();
    }
  };
  
  // 处理单个实例刷新
  const handleRefreshInstance = async (instanceId) => {
    if (isConnected) {
      await refreshInstance(instanceId);
      message.success('已请求刷新实例状态');
    } else {
      await fetchInstanceData();
    }
  };
  


  // 组件挂载时获取数据
  useEffect(() => {
    fetchInstanceData();
  }, []);

  const getStatusTag = (status, isRealtime = false) => {
    const statusMap = {
      running: { color: 'success', text: '运行中' },
      error: { color: 'error', text: '异常' }
    };
    // 确保status有值，如果为undefined/null则使用'error'
    const normalizedStatus = status || 'error';
    const config = statusMap[normalizedStatus] || statusMap.error;
    
    return (
      <Space>
        <Tag color={config.color}>{config.text}</Tag>
        {isRealtime && (
          <Tooltip title="实时状态">
            <Badge status="processing" />
          </Tooltip>
        )}
      </Space>
    );
  };

  const handleEdit = (record) => {
    setEditingInstance(record);
    // 解析IP地址为host和port
    const [host, port] = record.ip.split(':');
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      ip: record.ip,
      username: record.username || '',
      password: record.password || ''
    });
    setIsModalVisible(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除实例 "${record.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      async onOk() {
        try {
          const response = await fetch(API_ENDPOINTS.INSTANCE_DETAIL(record.key), {
            method: 'DELETE'
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '删除失败');
          }
          
          message.success('删除成功');
          fetchInstanceData(); // 刷新数据
        } catch (error) {
          console.error('删除失败:', error);
          message.error(error.message || '删除失败，请稍后重试');
        }
      }
    });
  };

  const handleAddInstance = () => {
    setEditingInstance(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // 解析连接地址
      const [host, port] = values.ip.split(':');
      
      const requestData = {
        name: values.name,
        host: host,
        port: parseInt(port) || 3306,
        type: values.type,
        username: values.username || '',
        password: values.password || ''
      };
      
      let response;
      if (editingInstance) {
        // 编辑模式
        response = await fetch(API_ENDPOINTS.INSTANCE_DETAIL(editingInstance.key), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      } else {
        // 新增模式
        response = await fetch(API_ENDPOINTS.INSTANCES, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        });
      }
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '保存失败');
      }
      
      const result = await response.json();
      message.success(result.message || '保存成功');
      setIsModalVisible(false);
      form.resetFields();
      setEditingInstance(null);
      fetchInstanceData(); // 刷新数据
      
    } catch (error) {
      console.error('保存失败:', error);
      message.error(error.message || '保存失败，请检查输入数据');
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
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
            {record.lastCheckTime && (
              <div style={{ fontSize: 11, color: '#999' }}>
                最后检查: {new Date(record.lastCheckTime).toLocaleString()}
              </div>
            )}
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => getStatusTag(status, record.isRealtime)
    },

    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Tooltip title="刷新状态">
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleRefreshInstance(record.id)}
              disabled={!isConnected}
            />
          </Tooltip>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys
  };

  return (
    <div>
      {/* 页面标题 */}
      <div className="page-header">
        <h1>实例管理</h1>
        <p>添加、删除和配置数据库实例</p>
      </div>

      {/* 状态栏 */}
      <Card className="content-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <Badge 
                  status={isConnected ? 'processing' : 'error'} 
                  text={isConnected ? 'WebSocket已连接' : 'WebSocket未连接'}
                />
              </div>
              {lastUpdate && (
                <div style={{ fontSize: 12, color: '#666' }}>
                  最后更新: {lastUpdate.toLocaleString()}
                </div>
              )}
            </div>
          </Space>
          
          <Space>
            <div style={{ fontSize: 12, color: '#666' }}>
              总计: {statusStats.total} | 
              运行: <span style={{ color: '#52c41a' }}>{statusStats.running}</span> | 
              异常: <span style={{ color: '#ff4d4f' }}>{statusStats.error}</span>
            </div>
          </Space>
        </div>
      </Card>

      {/* 操作栏 */}
      <Card className="content-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddInstance}
            >
              添加实例
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRefreshAll}
              disabled={loading}
            >
              刷新状态
            </Button>
            {!isConnected && (
              <Button
                icon={<WifiOutlined />}
                onClick={reconnect}
                type="dashed"
              >
                重新连接
              </Button>
            )}
            {selectedRowKeys.length > 0 && (
              <Button danger>
                批量删除 ({selectedRowKeys.length})
              </Button>
            )}
          </Space>
          
          <Space>
            <Search
              placeholder="搜索实例..."
              style={{ width: 200 }}
            />
            <Button icon={<FilterOutlined />}>筛选</Button>
          </Space>
        </div>
      </Card>

      {/* 实例列表 */}
      <Card className="content-card">
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={getMergedInstanceData()}
          loading={loading}
          pagination={{
            current: 1,
            pageSize: 10,
            total: instanceData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 添加/编辑实例弹窗 */}
      <Modal
        title={editingInstance ? '编辑实例' : '添加实例'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        width={600}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="name"
            label="实例名称"
            rules={[{ required: true, message: '请输入实例名称' }]}
          >
            <Input placeholder="请输入实例名称" />
          </Form.Item>
          
          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select placeholder="请选择数据库类型">
              <Option value="MySQL">MySQL</Option>
              <Option value="PostgreSQL">PostgreSQL</Option>
              <Option value="Redis">Redis</Option>
              <Option value="MongoDB">MongoDB</Option>
              <Option value="Oracle">Oracle</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="ip"
            label="连接地址"
            rules={[{ required: true, message: '请输入连接地址' }]}
          >
            <Input placeholder="例如: 192.168.1.100:3306" />
          </Form.Item>
          
          <Form.Item
            name="username"
            label="用户名"
          >
            <Input placeholder="请输入数据库用户名（可选）" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="请输入数据库密码（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InstanceManagement;