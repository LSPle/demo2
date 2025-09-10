import React, { useState } from 'react';
import { Form, Input, Button, Card, Checkbox, message, Divider } from 'antd';
import { UserOutlined, LockOutlined, EyeTwoTone, EyeInvisibleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './Login.css';

const Login = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (values) => {
    setLoading(true);
    try {
      // 模拟登录验证
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 简单的用户名密码验证
      if (values.username === 'admin' && values.password === 'admin123') {
        message.success('登录成功！');
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('username', values.username);
        navigate('/overview');
      } else {
        message.error('用户名或密码错误！');
      }
    } catch (error) {
      message.error('登录失败，请重试！');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginFailed = (errorInfo) => {
    message.error('请检查输入信息');
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-overlay"></div>
      </div>
      
      <div className="login-content">
        <Card className="login-card fade-in-up">
          <div className="login-header">
            <div className="login-logo">
              <div className="logo-icon">
                <UserOutlined />
              </div>
            </div>
            <h1 className="login-title">数据库优化平台</h1>
            <p className="login-subtitle">Database Optimization Platform</p>
          </div>

          <Form
            form={form}
            name="login"
            size="large"
            onFinish={handleLogin}
            onFinishFailed={handleLoginFailed}
            autoComplete="off"
            className="login-form"
          >
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名！' },
                { min: 3, message: '用户名至少3位字符！' }
              ]}
            >
              <Input
                prefix={<UserOutlined className="input-icon" />}
                placeholder="用户名"
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[
                { required: true, message: '请输入密码！' },
                { min: 6, message: '密码至少6位字符！' }
              ]}
            >
              <Input.Password
                prefix={<LockOutlined className="input-icon" />}
                placeholder="密码"
                className="login-input"
                iconRender={(visible) => 
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
              />
            </Form.Item>

            <Form.Item>
              <div className="login-options">
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox className="remember-checkbox">记住我</Checkbox>
                </Form.Item>
                <a className="forgot-password" href="#forgot">
                  忘记密码？
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="login-button"
                loading={loading}
                block
              >
                {loading ? '登录中...' : '登录'}
              </Button>
            </Form.Item>

            <Divider className="login-divider">
              <span style={{ color: '#8c8c8c', fontSize: '14px' }}>或</span>
            </Divider>

            <div className="demo-account">
              <p className="demo-title">演示账号：</p>
              <p className="demo-info">用户名：admin | 密码：admin123</p>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default Login;