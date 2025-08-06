/**
 * Nacos 配置读取模块
 * 基于 nacos 官方 SDK 封装，提供易用的配置读取功能
 * 支持 Express.js 和 NestJS 项目直接使用
 */

// Nacos 客户端接口定义（兼容官方 SDK）
interface NacosClientOptions {
  serverAddr?: string;
  namespace?: string;
  requestTimeout?: number;
  logLevel?: string;
  cacheDir?: string;
  endpoint?: string;
  regionId?: string;
  accessKey?: string;
  secretKey?: string;
  username?: string;
  password?: string;
}

interface NacosSubscribeParam {
  dataId: string;
  group?: string;
}

// 动态导入 nacos 模块
let NacosConfigClient: any = null;

try {
  const nacosModule = require('nacos');
  NacosConfigClient = nacosModule.NacosConfigClient;
} catch (error) {
  // nacos 模块未安装，使用时会抛出错误
}



/**
 * Nacos 配置选项
 */
export interface NacosConfigOptions {
  /** Nacos 服务器地址 (直连模式)，例如: '127.0.0.1:8848' */
  serverAddr?: string;
  /** 命名空间 ID */
  namespace?: string;
  /** 请求超时时间(ms)，默认 6000 */
  requestTimeout?: number;
  /** 日志级别，默认 'info' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** 缓存目录，默认使用临时目录 */
  cacheDir?: string;
  
  // ACM/EDAS 模式配置 (阿里云)
  /** ACM/EDAS 接入点 */
  endpoint?: string;
  /** 地域 ID */
  regionId?: string;
  /** 访问密钥 */
  accessKey?: string;
  /** 密钥 */
  secretKey?: string;
  
  // 认证配置
  /** 用户名 */
  username?: string;
  /** 密码 */
  password?: string;
}

/**
 * 配置项参数
 */
export interface ConfigParam {
  /** 配置 ID */
  dataId: string;
  /** 分组名，默认 'DEFAULT_GROUP' */
  group?: string;
}

/**
 * 配置变更监听参数
 */
export interface ConfigListenParam extends ConfigParam {
  /** 配置变更回调函数 */
  onChanged: (content: string) => void;
}

/**
 * Nacos 配置读取错误
 */
export class NacosConfigError extends Error {
  constructor(
    message: string,
    public operation: string,
    public dataId?: string,
    public group?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'NacosConfigError';
  }
}

/**
 * Nacos 配置客户端封装类
 * 提供简单易用的配置读取功能
 */
export class NacosConfig {
  private client: any = null;
  private options: NacosConfigOptions;
  private isInitialized = false;

  /**
   * 构造函数
   * @param options Nacos 配置选项
   */
  constructor(options: NacosConfigOptions) {
    this.options = {
      requestTimeout: 6000,
      logLevel: 'info',
      ...options
    };
  }

  /**
   * 初始化 Nacos 客户端
   */
  async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 检查 nacos 模块是否可用
      if (!NacosConfigClient) {
        throw new NacosConfigError(
          'nacos 模块未安装，请运行: npm install nacos',
          'init'
        );
      }

      // 验证必要参数
      if (!this.options.serverAddr && !this.options.endpoint) {
        throw new NacosConfigError(
          'serverAddr 或 endpoint 必须至少配置一个',
          'init'
        );
      }

      const clientOptions: NacosClientOptions = {
        serverAddr: this.options.serverAddr,
        namespace: this.options.namespace,
        requestTimeout: this.options.requestTimeout,
        logLevel: this.options.logLevel,
        cacheDir: this.options.cacheDir,
        endpoint: this.options.endpoint,
        regionId: this.options.regionId,
        accessKey: this.options.accessKey,
        secretKey: this.options.secretKey,
        username: this.options.username,
        password: this.options.password,
      };

      this.client = new NacosConfigClient(clientOptions);

      this.isInitialized = true;
    } catch (error) {
      throw new NacosConfigError(
        `Nacos 客户端初始化失败: ${error instanceof Error ? error.message : String(error)}`,
        'init',
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 确保客户端已初始化
   */
  private ensureInitialized(): void {
    if (!this.isInitialized || !this.client) {
      throw new NacosConfigError('Nacos 客户端未初始化，请先调用 init() 方法', 'check_init');
    }
  }

  /**
   * 获取配置
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 配置内容
   */
  async getConfig(dataId: string, group: string = 'DEFAULT_GROUP'): Promise<string | null> {
    this.ensureInitialized();
    
    try {
      const content = await this.client!.getConfig(dataId, group);
      return content || null;
    } catch (error) {
      throw new NacosConfigError(
        `获取配置失败: ${error instanceof Error ? error.message : String(error)}`,
        'getConfig',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 获取 JSON 配置并解析
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 解析后的 JSON 对象
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
        `JSON 配置解析失败: ${error instanceof Error ? error.message : String(error)}`,
        'parseJson',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 监听配置变更
   * @param param 监听参数
   */
  async subscribe(param: ConfigListenParam): Promise<void> {
    this.ensureInitialized();
    
    const { dataId, group = 'DEFAULT_GROUP', onChanged } = param;
    
    try {
      const subscribeParam: NacosSubscribeParam = {
        dataId,
        group,
      };
      
      await this.client!.subscribe(subscribeParam, (content: string) => {
        try {
          onChanged(content);
        } catch (error) {
          console.error(`配置变更回调执行失败 [${dataId}@${group}]:`, error);
        }
      });
    } catch (error) {
      throw new NacosConfigError(
        `监听配置变更失败: ${error instanceof Error ? error.message : String(error)}`,
        'subscribe',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 取消配置监听
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   */
  async unsubscribe(dataId: string, group: string = 'DEFAULT_GROUP'): Promise<void> {
    this.ensureInitialized();
    
    try {
      const subscribeParam: NacosSubscribeParam = {
        dataId,
        group,
      };
      
      await this.client!.unSubscribe(subscribeParam);
    } catch (error) {
      throw new NacosConfigError(
        `取消配置监听失败: ${error instanceof Error ? error.message : String(error)}`,
        'unsubscribe',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 发布配置
   * @param dataId 配置 ID
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @param content 配置内容
   * @returns 是否发布成功
   */
  async publishConfig(dataId: string, group: string = 'DEFAULT_GROUP', content: string): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await this.client!.publishSingle(dataId, group, content);
    } catch (error) {
      throw new NacosConfigError(
        `发布配置失败: ${error instanceof Error ? error.message : String(error)}`,
        'publishConfig',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 删除配置
   * @param dataId 配置 ID  
   * @param group 分组名，默认 'DEFAULT_GROUP'
   * @returns 是否删除成功
   */
  async removeConfig(dataId: string, group: string = 'DEFAULT_GROUP'): Promise<boolean> {
    this.ensureInitialized();
    
    try {
      return await this.client!.remove(dataId, group);
    } catch (error) {
      throw new NacosConfigError(
        `删除配置失败: ${error instanceof Error ? error.message : String(error)}`,
        'removeConfig',
        dataId,
        group,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 关闭客户端连接
   */
  async close(): Promise<void> {
    if (this.client && this.isInitialized) {
      try {
        // Nacos 客户端通常会自动清理资源，这里主要是标记状态
        this.isInitialized = false;
        this.client = null;
      } catch (error) {
        console.warn('关闭 Nacos 客户端时出现警告:', error);
      }
    }
  }
}

/**
 * 创建 Nacos 配置客户端的工厂函数
 * @param options Nacos 配置选项
 * @returns Nacos 配置客户端实例
 */
export function createNacosConfig(options: NacosConfigOptions): NacosConfig {
  return new NacosConfig(options);
}

/**
 * 创建并初始化 Nacos 配置客户端
 * @param options Nacos 配置选项
 * @returns 已初始化的 Nacos 配置客户端实例
 */
export async function createAndInitNacosConfig(options: NacosConfigOptions): Promise<NacosConfig> {
  const nacosConfig = new NacosConfig(options);
  await nacosConfig.init();
  return nacosConfig;
}

// 导出敏感配置管理模块
export * from './secret-manager';

// 导出增强版 Nacos 配置模块
export * from './enhanced-nacos';

// 默认导出主类
export default NacosConfig;