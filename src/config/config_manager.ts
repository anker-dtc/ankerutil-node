import { NacosClient, NacosConfig } from './nacos_client';
import { SensitiveData } from '../sensitive/sensitive_data';

export interface EncryptedConfig {
  cbcKey: string;
  rootKey: { [version: string]: string };
}

export interface ConfigManagerOptions {
  nacos: NacosConfig;
  encryptedConfigDataId: string;
  encryptedConfigGroup: string;
  encryptedConfigTenant?: string;
}

export class ConfigManager {
  private nacosClient: NacosClient;
  private options: ConfigManagerOptions;
  private isInitialized: boolean = false;
  private encryptedConfig: EncryptedConfig | null = null;

  constructor(options: ConfigManagerOptions) {
    this.options = options;
    this.nacosClient = new NacosClient(options.nacos);
  }

  /**
   * 初始化配置管理器 - 只负责从Nacos加载加密配置
   */
  async initialize(): Promise<boolean> {
    try {
      // 从Nacos获取加密配置
      const encryptedConfigContent = await this.nacosClient.getConfig(
        this.options.encryptedConfigDataId,
        this.options.encryptedConfigGroup,
        this.options.encryptedConfigTenant
      );

      if (!encryptedConfigContent) {
        throw new Error('无法从Nacos获取加密配置');
      }

      // 解析加密配置
      this.encryptedConfig = JSON.parse(encryptedConfigContent);

      this.isInitialized = true;
      console.log('配置管理器初始化成功');
      return true;
    } catch (error) {
      console.error('配置管理器初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取加密配置 - 返回原始配置，不进行解密
   */
  getEncryptedConfig(): EncryptedConfig {
    if (!this.isInitialized || !this.encryptedConfig) {
      throw new Error('配置管理器未初始化，请先调用 initialize()');
    }
    return this.encryptedConfig;
  }

  /**
   * 创建独立的敏感数据处理器 - 用于批量操作
   */
  createSensitiveDataHandler(): SensitiveData {
    if (!this.isInitialized || !this.encryptedConfig) {
      throw new Error('配置管理器未初始化，请先调用 initialize()');
    }

    const sensitiveData = new SensitiveData();
    sensitiveData.initSensitiveKey(this.encryptedConfig.cbcKey, this.encryptedConfig.rootKey);
    return sensitiveData;
  }

  /**
   * 获取配置并自动解密敏感数据
   */
  async getConfig(dataId: string, group: string, tenant?: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('配置管理器未初始化，请先调用 initialize()');
    }

    try {
      const configContent = await this.nacosClient.getConfig(dataId, group, tenant);
      if (!configContent) {
        return null;
      }

      // 解析配置
      const config = JSON.parse(configContent);
      
      // 创建独立的处理器进行解密
      const sensitiveData = this.createSensitiveDataHandler();
      return this.decryptSensitiveFields(config, sensitiveData);
    } catch (error) {
      console.error('获取配置失败:', error);
      return null;
    }
  }

  /**
   * 发布配置，自动加密敏感数据
   */
  async publishConfig(dataId: string, group: string, config: any, tenant?: string): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('配置管理器未初始化，请先调用 initialize()');
    }

    try {
      // 创建独立的处理器进行加密
      const sensitiveData = this.createSensitiveDataHandler();
      const encryptedConfig = this.encryptSensitiveFields(config, sensitiveData);
      
      // 发布到Nacos
      return await this.nacosClient.publishConfig(dataId, group, JSON.stringify(encryptedConfig), tenant);
    } catch (error) {
      console.error('发布配置失败:', error);
      return false;
    }
  }

  /**
   * 监听配置变化
   */
  async listenConfig(dataId: string, group: string, callback: (config: any) => void, tenant?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('配置管理器未初始化，请先调用 initialize()');
    }

    await this.nacosClient.listenConfig(dataId, group, (content: string) => {
      try {
        const config = JSON.parse(content);
        const sensitiveData = this.createSensitiveDataHandler();
        const decryptedConfig = this.decryptSensitiveFields(config, sensitiveData);
        callback(decryptedConfig);
      } catch (error) {
        console.error('解析配置失败:', error);
      }
    });
  }

  /**
   * 加密敏感数据字段
   */
  private encryptSensitiveFields(obj: any, sensitiveData: SensitiveData): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.encryptSensitiveFields(item, sensitiveData));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && this.isSensitiveField(key)) {
        result[key] = sensitiveData.aes128Sha256EncryptSensitiveData(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.encryptSensitiveFields(value, sensitiveData);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 解密敏感数据字段
   */
  private decryptSensitiveFields(obj: any, sensitiveData: SensitiveData): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.decryptSensitiveFields(item, sensitiveData));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && this.isSensitiveField(key)) {
        result[key] = sensitiveData.aes128Sha256DecryptSensitiveData(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.decryptSensitiveFields(value, sensitiveData);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 判断字段是否为敏感数据字段
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'secret', 'key', 'token', 'credential',
      'auth', 'private', 'sensitive', 'encrypted'
    ];

    const lowerFieldName = fieldName.toLowerCase();
    return sensitiveFields.some(field => lowerFieldName.includes(field));
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    await this.nacosClient.close();
  }
} 