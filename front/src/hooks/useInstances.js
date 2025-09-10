import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { instanceService } from '../services/instanceService';

/**
 * 实例管理Hook
 * 提供实例列表的获取、实时更新和状态管理
 */
export const useInstances = () => {
  const { instances: wsInstances, isConnected } = useWebSocket();
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 从API获取实例列表
  const fetchInstances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await instanceService.getInstances();
      setInstances(response.data || []);
    } catch (err) {
      console.error('获取实例列表失败:', err);
      setError(err.message || '获取实例列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化时获取实例列表
  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // 当WebSocket连接状态变化时，同步实例列表
  useEffect(() => {
    if (isConnected && wsInstances.length > 0) {
      // 使用WebSocket中的实例数据，保持实时性
      setInstances(wsInstances);
      setLoading(false);
    } else if (!isConnected && instances.length === 0) {
      // WebSocket未连接且没有本地数据时，从API获取
      fetchInstances();
    }
  }, [isConnected, wsInstances, instances.length, fetchInstances]);

  // 手动刷新实例列表
  const refreshInstances = useCallback(() => {
    return fetchInstances();
  }, [fetchInstances]);

  // 获取实例选项（用于下拉菜单）
  const instanceOptions = instances.map(instance => ({
    value: instance.id,
    label: `${instance.instanceName} (${instance.host}:${instance.port})`,
    instance
  }));

  // 根据ID获取实例
  const getInstance = useCallback((instanceId) => {
    return instances.find(instance => instance.id === instanceId);
  }, [instances]);

  // 获取运行中实例数量
  const getRunningCount = useCallback(() => {
    return instances.filter(instance => instance.status === 'running').length;
  }, [instances]);

  // 获取异常实例数量
  const getErrorCount = useCallback(() => {
    return instances.filter(instance => instance.status === 'error').length;
  }, [instances]);

  return {
    instances,
    instanceOptions,
    loading,
    error,
    isConnected,
    fetchInstances,
    refreshInstances,
    getInstance,
    getRunningCount,
    getErrorCount
  };
};

export default useInstances;