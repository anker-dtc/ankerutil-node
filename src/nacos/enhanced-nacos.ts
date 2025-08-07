/**
 * 增强版 Nacos 配置客户端
 * 集成敏感配置解密功能，支持处理 {{xxx}} 变量形态的隐秘字段
 * 使用 HTTP 直连方式，避免 SDK 依赖问题
 */

import { SecretManager, SecretManageConfig, SecretManageError } from './secret-manager';
import { NacosClient, NacosClientConfig, NacosConfigError } from './nacos-client';

/**
 * 增强版 Nacos 配置选项
 */
export interface EnhancedNacosConfigOptions extends NacosClientConfig {
  /** 敏感配置管理配置（可选） */
  secretManager?: SecretManageConfig;
  /** 是否启用敏感配置处理，默认 true */
  enableSecretProcessing?: boolean;
  /** 敏感配置处理失败时的处理策略，默认 'return_original' */
  secretFailureStrategy?: 'return_original' | 'throw_error';
}

/**
 * 增强版 Nacos 配置客户端
 * 在 HTTP Nacos 客户端基础上增加敏感配置解密功能
 */
export class EnhancedNacosConfig {
  private nacosClient: NacosClient;
  private secretManager: SecretManager | null = null;
  private options: EnhancedNacosConfigOptions;

  constructor(options: EnhancedNacosConfigOptions) {
    this.options = {
      enableSecretProcessing: true,
      secretFailureStrategy: 'return_original',
      ...options
    };

    // 创建 Nacos 客户端
    this.nacosClient = new NacosClient({
      serverAddr: this.options.serverAddr,
      namespace: this.options.namespace,
      username: this.options.username,
      password: this.options.password,
      requestTimeout: this.options.requestTimeout
    });

    // 创建敏感配置管理器
    if (this.options.secretManager && this.options.enableSecretProcessing) {
      try {
        this.secretManager = new SecretManager(this.options.secretManager);
      } catch (error) {
        if (this.options.secretFailureStrategy === 'throw_error') {
          throw error;
        }
      }
    }
  }

  /**
   * 初始化客户端
   */
  async init(): Promise<void> {
    const connected = await this.nacosClient.testConnection();
    if (!connected) {
      throw new NacosConfigError(
        '无法连接到 Nacos 服务器',
        'init'
      );
    }
  }

  /**
   * 处理敏感配置
   * @param content 原始配置内容
   * @returns 处理后的配置内容和处理状态
   */
  private async processSecretConfig(content: string): Promise<{ content: string; isDecrypted: boolean }> {
    // 如果未启用敏感配置处理或没有配置管理器
    if (!this.options.enableSecretProcessing || !this.secretManager) {
      return { content, isDecrypted: false };
    }

    try {
      const decryptedContent = await this.secretManager.processSecretConfig(content);
      return { 
        content: decryptedContent, 
        isDecrypted: decryptedContent !== content 
      };
    } catch (error) {
      if (this.options.secretFailureStrategy === 'throw_error') {
        throw error;
      }
      
      // 返回原始内容
      return { content, isDecrypted: false };
    }
  }

  /**
   * 获取配置（支持敏感配置解密）
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 配置内容（解密后）
   */
  async getConfig(dataId: string, group?: string): Promise<string | null> {
    const originalContent = await this.nacosClient.getConfig(dataId, group);
    
    if (originalContent === null) {
      return null;
    }

    const { content } = await this.processSecretConfig(originalContent);
    return content;
  }

  /**
   * 获取 JSON 配置并解析（支持敏感配置解密）
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 解析后的 JSON 对象（解密后）
   */
  async getJsonConfig<T = any>(dataId: string, group?: string): Promise<T | null> {
    const content = await this.getConfig(dataId, group);
    
    if (!content) {
      return null;
    }

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new NacosConfigError(
        `JSON 配置解析失败: ${error instanceof Error ? error.message : String(error)}`,
        'parseJson',
        dataId,
        group,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 设置敏感配置管理器
   * @param config 敏感配置管理配置
   */
  setSecretManager(config: SecretManageConfig): void {
    try {
      this.secretManager = new SecretManager(config);
      this.options.secretManager = config;
    } catch (error) {
      if (this.options.secretFailureStrategy === 'throw_error') {
        throw error;
      }
    }
  }

  /**
   * 启用/禁用敏感配置处理
   * @param enabled 是否启用
   */
  setSecretProcessingEnabled(enabled: boolean): void {
    this.options.enableSecretProcessing = enabled;
  }

  /**
   * 设置敏感配置失败处理策略
   * @param strategy 处理策略
   */
  setSecretFailureStrategy(strategy: 'return_original' | 'throw_error'): void {
    this.options.secretFailureStrategy = strategy;
  }

  /**
   * 获取 Nacos 客户端（用于高级操作）
   * @returns Nacos 客户端实例
   */
  getNacosClient(): NacosClient {
    return this.nacosClient;
  }

  /**
   * 获取敏感配置管理器（用于高级操作）
   * @returns 敏感配置管理器实例
   */
  getSecretManager(): SecretManager | null {
    return this.secretManager;
  }

  /**
   * 检查是否启用了敏感配置处理
   * @returns 是否启用
   */
  isSecretProcessingEnabled(): boolean {
    return this.options.enableSecretProcessing === true && this.secretManager !== null;
  }

  /**
   * 测试连接
   * @returns 连接是否正常
   */
  async testConnection(): Promise<boolean> {
    return this.nacosClient.testConnection();
  }
}

/**
 * 创建增强版 Nacos 配置客户端的工厂函数
 * @param options 增强版 Nacos 配置选项
 * @returns 增强版 Nacos 配置客户端实例
 */
export function createEnhancedNacosConfig(options: EnhancedNacosConfigOptions): EnhancedNacosConfig {
  return new EnhancedNacosConfig(options);
}

/**
 * 创建并初始化增强版 Nacos 配置客户端
 * @param options 增强版 Nacos 配置选项
 * @returns 已初始化的增强版 Nacos 配置客户端实例
 */
export async function createAndInitEnhancedNacosConfig(options: EnhancedNacosConfigOptions): Promise<EnhancedNacosConfig> {
  const enhancedNacosConfig = new EnhancedNacosConfig(options);
  await enhancedNacosConfig.init();
  return enhancedNacosConfig;
}

// 默认导出主类
export default EnhancedNacosConfig;