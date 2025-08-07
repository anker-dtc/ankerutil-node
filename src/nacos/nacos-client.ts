/**
 * Nacos 配置客户端
 * 使用 HTTP API 直接访问 Nacos 服务器
 */

import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

export interface NacosClientConfig {
  serverAddr: string;
  namespace?: string;
  username?: string;
  password?: string;
  requestTimeout?: number;
}

export interface ConfigParam {
  dataId: string;
  group?: string;
}

export class NacosConfigError extends Error {
  constructor(
    message: string,
    public operation: string,
    public dataId?: string,
    public group?: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NacosConfigError';
  }
}

/**
 * Nacos 配置客户端
 * 使用 HTTP API 直接访问，提供基础的配置读取功能
 */
export class NacosClient {
  private config: NacosClientConfig;

  constructor(config: NacosClientConfig) {
    this.config = {
      namespace: 'public',
      requestTimeout: 10000,
      ...config
    };
  }

  /**
   * 构建请求 URL
   */
  private buildConfigUrl(dataId: string, group: string = 'DEFAULT_GROUP'): string {
    const baseUrl = `http://${this.config.serverAddr}/nacos/v1/cs/configs`;
    const params = new URLSearchParams();
    
    params.append('dataId', dataId);
    params.append('group', group);
    
    if (this.config.namespace && this.config.namespace !== 'public') {
      params.append('tenant', this.config.namespace);
    }
    
    if (this.config.username) {
      params.append('username', this.config.username);
    }
    
    if (this.config.password) {
      params.append('password', this.config.password);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * 发送 HTTP 请求
   */
  private async sendRequest(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.config.requestTimeout
      };

      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else if (res.statusCode === 404) {
            resolve(''); // 配置不存在
                  } else {
          reject(new NacosConfigError(
            `HTTP 请求失败: ${res.statusCode} ${res.statusMessage}`,
            'http_request',
            undefined,
            undefined,
            res.statusCode
          ));
        }
        });
      });

      req.on('error', (error) => {
        reject(new NacosConfigError(
          `请求失败: ${error.message}`,
          'request_error',
          undefined,
          undefined,
          undefined,
          error
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new NacosConfigError(
          '请求超时',
          'request_timeout'
        ));
      });

      req.end();
    });
  }

  /**
   * 获取配置
   */
  async getConfig(dataId: string, group: string = 'DEFAULT_GROUP'): Promise<string | null> {
    try {
      const url = this.buildConfigUrl(dataId, group);
      const content = await this.sendRequest(url);
      
      if (content === '') {
        return null; // 配置不存在
      }
      
      return content;
    } catch (error) {
      throw new NacosConfigError(
        `获取配置失败: ${error instanceof Error ? error.message : String(error)}`,
        'getConfig',
        dataId,
        group,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取 JSON 配置
   */
  async getJsonConfig<T = any>(dataId: string, group: string = 'DEFAULT_GROUP'): Promise<T | null> {
    const content = await this.getConfig(dataId, group);
    
    if (!content) {
      return null;
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new NacosConfigError(
        `JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        'parseJson',
        dataId,
        group,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 尝试获取一个可能不存在的配置来测试连接
      await this.getConfig('__test_connection__');
      return true;
    } catch (error) {
      if (error instanceof NacosConfigError && error.statusCode === 404) {
        return true; // 404 说明连接正常，只是配置不存在
      }
      return false;
    }
  }
}

/**
 * 创建 Nacos 客户端
 */
export function createNacosClient(config: NacosClientConfig): NacosClient {
  return new NacosClient(config);
}
