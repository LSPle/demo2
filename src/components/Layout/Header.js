import React from 'react';
import { Layout, Avatar, Dropdown, Space, Badge } from 'antd';
import { UserOutlined, BellOutlined, SettingOutlined, LogoutOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const Header = () => {
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true
    }
  ];

  const handleMenuClick = ({ key }) => {
    switch (key) {
      case 'logout':
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = '/login';
        break;
      case 'profile':
        console.log('个人资料');
        break;
      case 'settings':
        console.log('系统设置');
        break;
      default:
        break;
    }
  };

  return (
    <AntHeader
      className="fade-in-up"
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '0 28px',
        borderBottom: '1px solid rgba(240, 240, 240, 0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0,21,41,0.08)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderRadius: '0'
      }}
    >
      <div style={{ flex: 1 }} />
      
      <Space size={24}>
        {/* 通知铃铛 */}
        <Badge count={5} size="small">
          <BellOutlined
            className="pulse"
            style={{
              fontSize: 18,
              color: '#595959',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '8px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.8)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.2)';
              e.target.style.color = '#1890ff';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.color = '#595959';
            }}
          />
        </Badge>

        {/* 用户信息 */}
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: handleMenuClick
          }}
          placement="bottomRight"
          arrow
        >
          <Space 
            style={{ 
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              padding: '8px 16px',
              borderRadius: '20px',
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Avatar
              size={36}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontSize: 14,
                transition: 'all 0.3s ease'
              }}
            >
              admin
            </Avatar>
            <span
              style={{
                color: '#262626',
                fontSize: 14,
                fontWeight: 500,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}
            >
              admin
            </span>
          </Space>
        </Dropdown>
      </Space>
    </AntHeader>
  );
};

export default Header;