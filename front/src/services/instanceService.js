import { API_ENDPOINTS } from '../config/api';

/**
 * 实例服务 - 提供实例相关的API调用
 */
export const instanceService = {
  /**
   * 获取所有实例列表
   */
  async getInstances() {
    try {
      const response = await fetch(API_ENDPOINTS.INSTANCES);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        success: true,
        data: Array.isArray(data) ? data : []
      };
    } catch (error) {
      console.error('获取实例列表失败:', error);
      return {
        success: false,
        error: error.message,
        data: []
      };
    }
  },

  /**
   * 根据ID获取单个实例
   */
  async getInstance(instanceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.INSTANCES}/${instanceId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('获取实例详情失败:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  },

  /**
   * 创建新实例
   */
  async createInstance(instanceData) {
    try {
      const response = await fetch(API_ENDPOINTS.INSTANCES, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(instanceData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('创建实例失败:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  },

  /**
   * 更新实例
   */
  async updateInstance(instanceId, instanceData) {
    try {
      const response = await fetch(`${API_ENDPOINTS.INSTANCES}/${instanceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(instanceData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('更新实例失败:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  },

  /**
   * 删除实例
   */
  async deleteInstance(instanceId) {
    try {
      const response = await fetch(`${API_ENDPOINTS.INSTANCES}/${instanceId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('删除实例失败:', error);
      return {
        success: false,
        error: error.message,
        data: null
      };
    }
  }
};

export default instanceService;