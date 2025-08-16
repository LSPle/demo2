import React, { useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, Modal, Form, message } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  FilterOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined
} from '@ant-design/icons';

const { Search } = Input;
const { Option } = Select;

const InstanceManagement = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 实例数据
  const instanceData = [
    {
      key: '1',
      name: '主数据库-生产环境',
      ip: '192.168.1.101:3306',
      type: 'MySQL',
      version: '8.0.23',
      status: 'running',
      createTime: '2023-06-15 09:30:00'
    },
    {
      key: '2',
      name: '从数据库-生产环境',
      ip: '192.168.1.102:3306',
      type: 'MySQL',
      version: '8.0.23',
      status: 'running',
      createTime: '2023-06-15 10:15:00'
    },
    {
      key: '3',
      name: 'Redis缓存集群',
      ip: '192.168.1.105:6379',
      type: 'Redis',
      version: '6.2.5',
      status: 'warning',
      createTime: '2023-06-16 14:20:00'
    },
    {
      key: '4',
      name: 'MongoDB-日志数据库',
      ip: '192.168.1.108:27017',
      type: 'MongoDB',
      version: '5.0.3',
      status: 'error',
      createTime: '2023-06-18 16:45:00'
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

  const handleEdit = (record) => {
    form.setFieldsValue(record);
    setIsModalVisible(true);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除实例 "${record.name}" 吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk() {
        message.success('删除成功');
      }
    });
  };

  const handleAddInstance = () => {
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleModalOk = () => {
    form.validateFields().then(values => {
      console.log('表单数据:', values);
      message.success('保存成功');
      setIsModalVisible(false);
      form.resetFields();
    }).catch(info => {
      console.log('验证失败:', info);
    });
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
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
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
              onSearch={(value) => console.log('搜索:', value)}
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
          dataSource={instanceData}
          pagination={{
            current: 1,
            pageSize: 10,
            total: 12,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条记录`
          }}
        />
      </Card>

      {/* 添加/编辑实例弹窗 */}
      <Modal
        title="添加实例"
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
            name="version"
            label="版本"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例如: 8.0.23" />
          </Form.Item>
          
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入数据库用户名" />
          </Form.Item>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="请输入数据库密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InstanceManagement;