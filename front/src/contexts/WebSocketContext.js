import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [instances, setInstances] = useState([]);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY_BASE = 1000; // 1秒基础延迟

  // 连接WebSocket
  const connectSocket = useCallback(() => {
    if (socket?.connected) {
      return;
    }

    const newSocket = io('/', {
      path: '/socket.io',
      transports: ['polling'],
      upgrade: false,
      timeout: 30000,
      reconnection: false, // 手动控制重连
      forceNew: false,
      autoConnect: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      rememberUpgrade: false
    });

    // 连接成功
    newSocket.on('connect', () => {
      console.log('WebSocket连接成功');
      setIsConnected(true);
      setConnectionAttempts(0);
      setIsReconnecting(false);
      
      // 连接成功后立即获取实例状态
      newSocket.emit('get_instances_status');
    });

    // 连接断开
    newSocket.on('disconnect', (reason) => {
      console.log('WebSocket连接断开:', reason);
      setIsConnected(false);
      
      // 如果不是主动断开，尝试重连
      if (reason !== 'io client disconnect') {
        handleReconnect();
      }
    });

    // 连接错误
    newSocket.on('connect_error', (error) => {
      console.error('WebSocket连接错误:', error);
      setIsConnected(false);
      handleReconnect();
    });

    // 处理轮询错误
    newSocket.on('error', (error) => {
      console.error('Socket.IO错误:', error);
    });

    // 处理传输错误
    newSocket.io.on('error', (error) => {
      console.error('Socket.IO传输错误:', error);
    });

    // 监听实例状态更新
    newSocket.on('instances_status', (data) => {
      console.log('收到实例状态更新:', data);
      setInstances(data.instances || []);
      setLastUpdate(new Date(data.timestamp));
    });

    // 监听单个实例状态变化
    newSocket.on('status_change', (data) => {
      console.log('实例状态变化:', data);
      setInstances(prev => 
        prev.map(instance => 
          instance.id === data.instanceId 
            ? { ...instance, ...data.changes }
            : instance
        )
      );
      setLastUpdate(new Date());
    });

    // 监听更新响应
    newSocket.on('update_response', (data) => {
      console.log('更新响应:', data);
      if (data.success && data.instance) {
        setInstances(prev => 
          prev.map(instance => 
            instance.id === data.instance.id 
              ? data.instance
              : instance
          )
        );
        setLastUpdate(new Date());
      }
    });

    // 监听监控状态切换响应
    newSocket.on('monitoring_toggled', (data) => {
      console.log('监控状态切换:', data);
      if (data.success) {
        setInstances(prev => 
          prev.map(instance => 
            instance.id === data.instanceId 
              ? { ...instance, isMonitoring: data.isMonitoring }
              : instance
          )
        );
      }
    });

    // 监听实例创建事件
    newSocket.on('instance_created', (data) => {
      console.log('实例已创建:', data);
      setInstances(prev => [...prev, data.instance]);
      setLastUpdate(new Date());
    });

    // 监听实例更新事件
    newSocket.on('instance_updated', (data) => {
      console.log('实例已更新:', data);
      setInstances(prev => 
        prev.map(instance => 
          instance.id === data.instance.id 
            ? data.instance
            : instance
        )
      );
      setLastUpdate(new Date());
    });

    // 监听实例删除事件
    newSocket.on('instance_deleted', (data) => {
      console.log('实例已删除:', data);
      setInstances(prev => 
        prev.filter(instance => instance.id !== data.instanceId)
      );
      setLastUpdate(new Date());
    });

    // 监听错误
    newSocket.on('error', (data) => {
      console.error('WebSocket错误:', data);
    });

    setSocket(newSocket);
  }, [socket]);

  // 处理重连逻辑
  const handleReconnect = useCallback(() => {
    if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('达到最大重连次数，停止重连');
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    const delay = RECONNECT_DELAY_BASE * Math.pow(2, connectionAttempts); // 指数退避
    
    console.log(`${delay}ms后尝试第${connectionAttempts + 1}次重连`);
    
    setTimeout(() => {
      setConnectionAttempts(prev => prev + 1);
      connectSocket();
    }, delay);
  }, [connectionAttempts, connectSocket]);

  // 断开连接
  const disconnectSocket = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setIsReconnecting(false);
      setConnectionAttempts(0);
    }
  }, [socket]);

  // 手动请求更新
  const requestUpdate = useCallback((instanceId = null) => {
    if (socket?.connected) {
      socket.emit('request_update', { instanceId });
    }
  }, [socket]);

  // 切换实例监控状态
  const toggleMonitoring = useCallback((instanceId, isMonitoring) => {
    if (socket?.connected) {
      socket.emit('toggle_monitoring', { instanceId, isMonitoring });
    }
  }, [socket]);

  // 获取实例状态
  const getInstancesStatus = useCallback(() => {
    if (socket?.connected) {
      socket.emit('get_instances_status');
    }
  }, [socket]);

  // 组件挂载时连接
  useEffect(() => {
    connectSocket();
    
    // 组件卸载时断开连接
    return () => {
      disconnectSocket();
    };
  }, []);

  const value = {
    socket,
    isConnected,
    instances,
    lastUpdate,
    isReconnecting,
    connectionAttempts,
    connectSocket,
    disconnectSocket,
    requestUpdate,
    toggleMonitoring,
    getInstancesStatus,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export default WebSocketContext;