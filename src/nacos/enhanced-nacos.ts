/**
 * 增强版 Nacos 配置客户端
 * 集成敏感配置解密功能，支持处理 {{xxx}} 变量形态的隐秘字段
 */

import { NacosConfig, NacosConfigOptions, ConfigListenParam, NacosConfigError } from './index';
import { SecretManager, SecretManageConfig, SecretManageError } from './secret-manager';

/**
 * 增强版 Nacos 配置选项
 */
export interface EnhancedNacosConfigOptions extends NacosConfigOptions {
  /** 敏感配置管理配置（可选） */
  secretManager?: SecretManageConfig;
  /** 是否启用敏感配置处理，默认 true */
  enableSecretProcessing?: boolean;
  /** 敏感配置处理失败时的处理策略，默认 'return_original' */
  secretFailureStrategy?: 'return_original' | 'throw_error';
}

/**
 * 增强版配置监听参数
 */
export interface EnhancedConfigListenParam extends Omit<ConfigListenParam, 'onChanged'> {
  /** 配置变更回调函数，接收解密后的内容 */
  onChanged: (content: string, isDecrypted?: boolean) => void;
}

/**
 * 增强版 Nacos 配置客户端
 * 在标准 Nacos 客户端基础上增加敏感配置解密功能
 */
export class EnhancedNacosConfig {
  private nacosClient: NacosConfig;
  private secretManager: SecretManager | null = null;
  private options: EnhancedNacosConfigOptions;
  private isInitialized = false;

  constructor(options: EnhancedNacosConfigOptions) {
    this.options = {
      enableSecretProcessing: true,
      secretFailureStrategy: 'return_original',
      ...options
    };

    // 创建标准 Nacos 客户端
    this.nacosClient = new NacosConfig(options);

    // 创建敏感配置管理器
    if (this.options.secretManager && this.options.enableSecretProcessing) {
      try {
        this.secretManager = new SecretManager(this.options.secretManager);
      } catch (error) {
        console.warn('敏感配置管理器初始化失败:', error);
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
    if (this.isInitialized) {
      return;
    }

    try {
      await this.nacosClient.init();
      this.isInitialized = true;
    } catch (error) {
      throw new NacosConfigError(
        `增强版 Nacos 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        'init',
        undefined,
        undefined,
        error instanceof Error ? error : undefined
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
      console.warn('敏感配置处理失败:', error);
      
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
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 监听配置变更（支持敏感配置解密）
   * @param param 监听参数
   */
  async subscribe(param: EnhancedConfigListenParam): Promise<void> {
    const { dataId, group = 'DEFAULT_GROUP', onChanged } = param;
    
    // 包装回调函数以处理敏感配置
    const wrappedCallback = async (content: string) => {
      try {
        const { content: processedContent, isDecrypted } = await this.processSecretConfig(content);
        onChanged(processedContent, isDecrypted);
      } catch (error) {
        console.error(`配置变更处理失败 [${dataId}@${group}]:`, error);
        
        if (this.options.secretFailureStrategy === 'throw_error') {
          throw error;
        }
        
        // 使用原始内容回调
        onChanged(content, false);
      }
    };

    // 使用原始 Nacos 客户端监听
    await this.nacosClient.subscribe({
      dataId,
      group,
      onChanged: wrappedCallback
    });
  }

  /**
   * 取消配置监听
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   */
  async unsubscribe(dataId: string, group?: string): Promise<void> {
    return this.nacosClient.unsubscribe(dataId, group);
  }

  /**
   * 发布配置
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @param content 配置内容
   * @returns 是否发布成功
   */
  async publishConfig(dataId: string, group: string = 'DEFAULT_GROUP', content: string): Promise<boolean> {
    return this.nacosClient.publishConfig(dataId, group, content);
  }

  /**
   * 删除配置
   * @param dataId 配置 ID  
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 是否删除成功
   */
  async removeConfig(dataId: string, group?: string): Promise<boolean> {
    return this.nacosClient.removeConfig(dataId, group);
  }

  /**
   * 设置敏感配置管理器
   * @param config 敏感配置管理配置
   */
  setSecretManager(config: SecretManageConfig): void {
    try {
      this.secretManager = new SecretManager(config);
      this.options.secretManager = config;
      console.log('敏感配置管理器已更新');
    } catch (error) {
      console.warn('设置敏感配置管理器失败:', error);
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
   * 获取原始 Nacos 客户端（用于高级操作）
   * @returns 原始 Nacos 客户端实例
   */
  getRawNacosClient(): NacosConfig {
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
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    if (this.nacosClient && this.isInitialized) {
      await this.nacosClient.close();
      this.isInitialized = false;
      console.log('增强版 Nacos 客户端已关闭');
    }
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