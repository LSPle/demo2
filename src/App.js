import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import PageTransition from './components/PageTransition';
import InstanceOverview from './pages/InstanceOverview';
import InstanceManagement from './pages/InstanceManagement';
import SQLOptimization from './pages/SQLOptimization';
import SQLConsole from './pages/SQLConsole';
import ConfigOptimization from './pages/ConfigOptimization';

const { Content } = Layout;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <Header />
        <Content>
          <PageTransition>
            <Routes>
              <Route path="/" element={<InstanceOverview />} />
              <Route path="/overview" element={<InstanceOverview />} />
              <Route path="/management" element={<InstanceManagement />} />
              <Route path="/sql-optimization" element={<SQLOptimization />} />
              <Route path="/sql-console" element={<SQLConsole />} />
              <Route path="/config-optimization" element={<ConfigOptimization />} />
            </Routes>
          </PageTransition>
        </Content>
      </Layout>
    </Layout>
  );
}

export default App;