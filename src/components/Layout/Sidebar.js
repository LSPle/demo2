import React, { useState } from 'react';
import { Layout, Menu, Badge } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DatabaseOutlined,
  TableOutlined,
  CheckCircleOutlined,
  CodeOutlined,
  SettingOutlined,
  ControlOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BarChartOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Sider } = Layout;

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/overview',
      icon: <BarChartOutlined />,
      label: '实例概览'
    },
    {
      key: '/management',
      icon: <SettingOutlined />,
      label: '实例管理'
    },
    {
      key: '/sql-optimization',
      icon: <CodeOutlined />,
      label: 'SQL审核优化'
    },
    {
        key: '/sql-console',
        icon: <CodeOutlined />,
        label: 'SQL窗口'
      },
    {
      key: '/config-optimization',
      icon: <ControlOutlined />,
      label: '配置优化'
    },
    {
      key: '/architecture',
      icon: <DatabaseOutlined />,
      label: '架构优化'
    },
    // 新增：慢查询日志
    {
      key: '/slowlog',
      icon: <ClockCircleOutlined />,
      label: '慢查询日志'
    }
  ];

  const onClick = ({ key }) => {
    navigate(key);
  };

  const selectedKeys = [menuItems.find(m => location.pathname.startsWith(m.key))?.key || '/overview'];

  return (
    <Sider 
      collapsible 
      collapsed={collapsed} 
      onCollapse={setCollapsed} 
      width={220} 
      theme="light"
      style={{
        background: 'var(--color-bg)',
        borderRight: '1px solid var(--color-border)'
      }}
    >
      {/* 标题区域 */}
      <div style={{ 
        height: 64, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '0 var(--space-md)',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg-panel)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)'
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-2) 100%)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 'var(--font-lg)',
            fontWeight: 'bold'
          }}>
            目
          </div>
          {!collapsed && (
            <span style={{
              fontSize: 'var(--font-lg)',
              fontWeight: 600,
              color: 'var(--color-text)'
            }}>
              数据库性能优化平台
            </span>
          )}
        </div>
      </div>
      
      {/* 菜单区域 */}
      <Menu
        mode="inline"
        selectedKeys={selectedKeys}
        items={menuItems}
        onClick={onClick}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 'var(--space-xs) 0'
        }}
        theme="light"
      />
    </Sider>
  );
};

export default Sidebar;