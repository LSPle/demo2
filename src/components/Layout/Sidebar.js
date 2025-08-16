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
  BarChartOutlined
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
    }
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const getSelectedKey = () => {
    const path = location.pathname;
    return path === '/' ? '/overview' : path;
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      theme="light"
      width={240}
      style={{
        boxShadow: '2px 0 20px rgba(0,21,41,0.15)',
        zIndex: 100,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        className="fade-in-up"
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
          backdropFilter: 'blur(5px)',
          margin: '8px 0',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.1)'
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: collapsed ? 0 : 12,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: collapsed ? 'scale(1.1)' : 'scale(1)',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
        >
          <DatabaseOutlined
            className={collapsed ? 'pulse' : ''}
            style={{
              fontSize: 18,
              color: '#ffffff',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          />
        </div>
        {!collapsed && (
          <span
            className="fade-in-right"
            style={{
              fontSize: 16,
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.5px'
            }}
          >
            数据库优化平台
          </span>
        )}
      </div>

      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        onClick={handleMenuClick}
        className="fade-in-up"
        style={{
          borderRight: 0,
          background: 'transparent',
          height: 'calc(100vh - 64px - 60px)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        items={menuItems.map((item, index) => ({
          ...item,
          style: {
            margin: '4px 8px',
            borderRadius: '12px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            animationDelay: `${index * 0.1}s`
          }
        }))}
      />

      {/* 系统状态 */}
      <div
        className="fade-in-up"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 60,
          borderTop: '1px solid rgba(240, 240, 240, 0.5)',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          borderRadius: '0 0 20px 0'
        }}
      >
        <Badge status="success" />
        {!collapsed && (
          <span style={{ marginLeft: 8, fontSize: 12, color: '#8c8c8c' }}>
            服务正常
          </span>
        )}
      </div>
    </Sider>
  );
};

export default Sidebar;