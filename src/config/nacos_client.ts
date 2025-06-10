import { NacosConfigClient } from 'nacos';

export interface NacosConfig {
  serverAddr: string;
  namespace?: string;
  username?: string;
  password?: string;
  accessToken?: string;
}

export interface ConfigItem {
  dataId: string;
  group: string;
  content: string;
  tenant?: string;
}

export class NacosClient {
  private client: NacosConfigClient;
  private config: NacosConfig;
  private accessToken: string | null = null;

  constructor(config: NacosConfig) {
    this.config = config;
    this.client = new NacosConfigClient({
      serverAddr: config.serverAddr,
      namespace: config.namespace || '',
      username: config.username,
      password: config.password,
    });
  }

  /**
   * 登录获取访问令牌
   */
  async login(): Promise<boolean> {
    if (!this.config.username || !this.config.password) {
      return true; // 无需认证
    }

    try {
      const response = await fetch(`${this.config.serverAddr}/nacos/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `username=${encodeURIComponent(this.config.username)}&password=${encodeURIComponent(this.config.password)}`,
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.accessToken;
      return true;
    } catch (error) {
      console.error('Nacos登录失败:', error);
      return false;
    }
  }

  /**
   * 获取配置
   */
  async getConfig(dataId: string, group: string, tenant?: string): Promise<string | null> {
    try {
      // 如果需要认证且没有token，先登录
      if (this.config.username && !this.accessToken) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Nacos authentication failed');
        }
      }

      const config = await this.client.getConfig(dataId, group);
      return config;
    } catch (error) {
      console.error('获取Nacos配置失败:', error);
      return null;
    }
  }

  /**
   * 发布配置
   */
  async publishConfig(dataId: string, group: string, content: string, tenant?: string): Promise<boolean> {
    try {
      if (this.config.username && !this.accessToken) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Nacos authentication failed');
        }
      }

      await this.client.publishSingle(dataId, group, content);
      return true;
    } catch (error) {
      console.error('发布Nacos配置失败:', error);
      return false;
    }
  }

  /**
   * 删除配置
   */
  async removeConfig(dataId: string, group: string, tenant?: string): Promise<boolean> {
    try {
      if (this.config.username && !this.accessToken) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          throw new Error('Nacos authentication failed');
        }
      }

      await this.client.remove(dataId, group);
      return true;
    } catch (error) {
      console.error('删除Nacos配置失败:', error);
      return false;
    }
  }

  /**
   * 监听配置变化
   */
  async listenConfig(dataId: string, group: string, callback: (content: string) => void): Promise<void> {
    try {
      this.client.subscribe({
        dataId,
        group,
      }, callback);
    } catch (error) {
      console.error('监听Nacos配置失败:', error);
    }
  }

  /**
   * 取消监听配置变化
   */
  async unlistenConfig(dataId: string, group: string): Promise<void> {
    try {
      this.client.unSubscribe({
        dataId,
        group,
      }, () => {});
    } catch (error) {
      console.error('取消监听Nacos配置失败:', error);
    }
  }

  /**
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    try {
      await this.client.close();
    } catch (error) {
      console.error('关闭Nacos客户端失败:', error);
    }
  }
} 