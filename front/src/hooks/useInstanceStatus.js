import { useCallback, useEffect, useState } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';

/**
 * 自定义Hook：管理实例状态和WebSocket连接
 */
export const useInstanceStatus = () => {
  const {
    isConnected,
    instances,
    lastUpdate,
    isReconnecting,
    connectionAttempts,
    requestUpdate,
    toggleMonitoring,
    getInstancesStatus,
    connectSocket,
    disconnectSocket
  } = useWebSocket();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 获取指定实例
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

  // 获取状态统计
  const getStatusStats = useCallback(() => {
    const stats = {
      total: instances.length,
      running: 0,
      error: 0
    };

    instances.forEach(instance => {
      const status = instance.status || 'error';
      if (stats.hasOwnProperty(status)) {
        stats[status]++;
      } else {
        stats.error++;
      }
    });

    return stats;
  }, [instances]);

  // 刷新指定实例状态
  const refreshInstance = useCallback(async (instanceId) => {
    if (!isConnected) {
      setError('WebSocket未连接');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      requestUpdate(instanceId);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isConnected, requestUpdate]);

  // 刷新所有实例状态
  const refreshAllInstances = useCallback(async () => {
    if (!isConnected) {
      setError('WebSocket未连接');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      getInstancesStatus();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isConnected, getInstancesStatus]);

  // 切换实例监控
  const toggleInstanceMonitoring = useCallback(async (instanceId, isMonitoring) => {
    if (!isConnected) {
      setError('WebSocket未连接');
      return false;
    }

    try {
      setLoading(true);
      setError(null);
      toggleMonitoring(instanceId, isMonitoring);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isConnected, toggleMonitoring]);

  // 重新连接WebSocket
  const reconnect = useCallback(() => {
    disconnectSocket();
    setTimeout(() => {
      connectSocket();
    }, 1000);
  }, [connectSocket, disconnectSocket]);

  // 获取连接状态信息
  const getConnectionInfo = useCallback(() => {
    return {
      isConnected,
      isReconnecting,
      connectionAttempts,
      lastUpdate,
      canReconnect: connectionAttempts < 5
    };
  }, [isConnected, isReconnecting, connectionAttempts, lastUpdate]);

  // 检查实例是否在线
  const isInstanceOnline = useCallback((instanceId) => {
    const instance = getInstance(instanceId);
    return instance?.status === 'running';
  }, [getInstance]);

  // 检查实例是否正在监控
  const isInstanceMonitoring = useCallback((instanceId) => {
    const instance = getInstance(instanceId);
    return instance?.isMonitoring === true;
  }, [getInstance]);

  // 获取实例最后检查时间
  const getInstanceLastCheck = useCallback((instanceId) => {
    const instance = getInstance(instanceId);
    return instance?.lastCheckTime ? new Date(instance.lastCheckTime) : null;
  }, [getInstance]);

  // 自动刷新逻辑
  useEffect(() => {
    if (isConnected && instances.length === 0) {
      // 连接成功但没有实例数据时，主动获取
      getInstancesStatus();
    }
  }, [isConnected, instances.length, getInstancesStatus]);

  // 清除错误状态
  useEffect(() => {
    if (isConnected && error) {
      setError(null);
    }
  }, [isConnected, error]);

  return {
    // 状态数据
    instances,
    loading,
    error,
    lastUpdate,
    
    // 连接状态
    ...getConnectionInfo(),
    
    // 统计信息
    statusStats: getStatusStats(),
    runningCount: getRunningCount(),
    errorCount: getErrorCount(),
    
    // 实例操作
    getInstance,
    refreshInstance,
    refreshAllInstances,
    toggleInstanceMonitoring,
    isInstanceOnline,
    isInstanceMonitoring,
    getInstanceLastCheck,
    
    // 连接操作
    reconnect,
    
    // 工具方法
    clearError: () => setError(null)
  };
};

export default useInstanceStatus;