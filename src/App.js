import React from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import PageTransition from './components/PageTransition';
import InstanceOverview from './pages/InstanceOverview';
import InstanceManagement from './pages/InstanceManagement';
import SQLOptimization from './pages/SQLOptimization';
import SQLConsole from './pages/SQLConsole';
import ConfigOptimization from './pages/ConfigOptimization';
import Login from './pages/Login';

const { Content } = Layout;

const AppLayout = ({ children }) => (
  <Layout style={{ minHeight: '100vh' }}>
    <Sidebar />
    <Layout>
      <Header />
      <Content>
        <PageTransition>{children}</PageTransition>
      </Content>
    </Layout>
  </Layout>
);

function App() {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const isLoginPath = location.pathname === '/login';

  if (!isLoggedIn && !isLoginPath) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (isLoginPath && isLoggedIn) {
    return <Navigate to="/overview" replace />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<InstanceOverview />} />
        <Route path="/overview" element={<InstanceOverview />} />
        <Route path="/management" element={<InstanceManagement />} />
        <Route path="/sql-optimization" element={<SQLOptimization />} />
        <Route path="/sql-console" element={<SQLConsole />} />
        <Route path="/config-optimization" element={<ConfigOptimization />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </AppLayout>
  );
}

export default App;