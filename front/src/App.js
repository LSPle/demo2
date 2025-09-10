import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
// import PageTransition from './components/PageTransition'; // 移除过渡以保证不卸载组件
import InstanceOverview from './pages/InstanceOverview';
import InstanceManagement from './pages/InstanceManagement';
import SQLOptimization from './pages/SQLOptimization';
import SQLConsole from './pages/SQLConsole';
import ConfigOptimization from './pages/ConfigOptimization';
import Login from './pages/Login';
import ArchitectureOptimization from './pages/ArchitectureOptimization';
import SlowQueryLogs from './pages/SlowQueryLogs';

const { Content } = Layout;

const AppLayout = ({ children }) => (
  <Layout style={{ minHeight: '100vh' }}>
    <Sidebar />
    <Layout>
      <Header />
      <Content>
        {/* 直接渲染 children，避免过渡组件导致卸载 */}
        {children}
      </Content>
    </Layout>
  </Layout>
);

const App = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = true; // 简化处理，默认已登录

  // 定义顶层路由与页面组件映射（仅一级路径）
  const routeDefs = useMemo(() => ([
    { path: '/overview', element: <InstanceOverview /> },
    { path: '/management', element: <InstanceManagement /> },
    { path: '/sql-optimization', element: <SQLOptimization /> },
    { path: '/sql-console', element: <SQLConsole /> },
    { path: '/config-optimization', element: <ConfigOptimization /> },
    { path: '/architecture', element: <ArchitectureOptimization /> },
    { path: '/slowlog', element: <SlowQueryLogs /> },
    { path: '/login', element: <Login /> },
  ]), []);

  const basePaths = useMemo(() => routeDefs.map(r => r.path), [routeDefs]);

  const getBasePath = (pathname) => {
    // 按最长前缀匹配，确保 /sql-console 等被正确识别
    const match = basePaths
      .filter(p => pathname.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];
    return match || '/overview';
  };

  const activeBasePath = getBasePath(location.pathname);

  // 访问过的页面集合（保持已挂载的页面不被卸载，实现持久化）
  const [visited, setVisited] = useState(() => new Set([activeBasePath]));
  useEffect(() => {
    setVisited(prev => {
      if (prev.has(activeBasePath)) return prev;
      const next = new Set(prev);
      next.add(activeBasePath);
      return next;
    });
  }, [activeBasePath]);

  // 初始重定向：从根路径跳转到 /overview
  useEffect(() => {
    if (location.pathname === '/') {
      navigate('/overview', { replace: true });
    }
  }, [location.pathname, navigate]);

  // 简单的登录守卫（示例）：未登录时跳转到 /login
  useEffect(() => {
    if (!isAuthenticated && activeBasePath !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, activeBasePath, navigate]);

  // 仅渲染访问过的页面，并根据当前激活路径显示/隐藏
  const keepAliveViews = Array.from(visited)
    .map((p) => {
      const def = routeDefs.find(r => r.path === p);
      if (!def) return null;
      const isActive = p === activeBasePath;
      return (
        <div key={p} style={{ display: isActive ? 'block' : 'none', height: '100%' }}>
          {def.element}
        </div>
      );
    })
    .filter(Boolean);

  // 如果当前是登录页面，直接渲染登录组件，不使用AppLayout
  if (activeBasePath === '/login') {
    return keepAliveViews;
  }

  // 其他页面使用AppLayout包装
  return (
    <AppLayout>
      {keepAliveViews}
    </AppLayout>
  );
};

export default App;