import { ConfigManager, SensitiveData } from '../index';
import { AdvancedEncryptionSubscriber, createEncryptedFieldDecorator, createEncryptedJsonFieldDecorator } from './advanced_subscriber';

// TypeORM类型声明（避免直接依赖typeorm包）
export interface DataSourceOptions {
  type: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  entities?: any[];
  subscribers?: any[];
  synchronize?: boolean;
  [key: string]: any;
}

export interface DataSource {
  initialize(): Promise<void>;
  destroy(): Promise<void>;
  isInitialized: boolean;
  [key: string]: any;
}

export interface EntitySubscriberInterface {
  listenTo?(): any;
  beforeInsert?(event: InsertEvent<any>): void;
  beforeUpdate?(event: UpdateEvent<any>): void;
  afterLoad?(entity: any): void;
}

export interface InsertEvent<T> {
  entity: T;
}

export interface UpdateEvent<T> {
  entity: T;
}

export interface LoadEvent<T> {
  entity: T;
}

export interface TypeORMIntegrationOptions {
  // 数据库配置
  database: DataSourceOptions;
  
  // Nacos配置
  nacos: {
    serverAddr: string;
    namespace?: string;
    username?: string;
    password?: string;
  };
  
  // 加密配置
  encryptedConfigDataId: string;
  encryptedConfigGroup?: string;
  
  // 实体配置
  entities: any[];
  
  // 敏感字段配置
  sensitiveFields?: Map<any, string[]>;
  
  // 是否自动注册敏感数据Subscriber
  autoRegisterSensitiveSubscriber?: boolean;
  
  // 是否使用高级Subscriber（支持JSON路径加密）
  useAdvancedSubscriber?: boolean;
  
  // 日志器
  logger?: any;
}

export interface SensitiveFieldConfig {
  entity: any;
  fields: string[];
}

/**
 * TypeORM集成管理器
 * 封装了TypeORM连接、Subscriber注册、敏感数据处理等逻辑
 */
export class TypeORMIntegration {
  private dataSource!: DataSource;
  private configManager!: ConfigManager;
  private sensitiveData!: SensitiveData;
  private options: TypeORMIntegrationOptions;
  private isInitialized: boolean = false;

  constructor(options: TypeORMIntegrationOptions) {
    this.options = {
      autoRegisterSensitiveSubscriber: true,
      encryptedConfigGroup: 'DEFAULT_GROUP',
      useAdvancedSubscriber: false,
      ...options
    };
  }

  /**
   * 初始化TypeORM集成
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 1. 初始化配置管理器
      this.configManager = new ConfigManager({
        nacos: this.options.nacos,
        encryptedConfigDataId: this.options.encryptedConfigDataId,
        encryptedConfigGroup: this.options.encryptedConfigGroup || 'DEFAULT_GROUP'
      });

      await this.configManager.initialize();
      this.sensitiveData = this.configManager.createSensitiveDataHandler();

      // 2. 创建DataSource
      const dataSourceOptions: DataSourceOptions = {
        ...this.options.database,
        entities: this.options.entities,
        subscribers: []
      };

      // 3. 自动注册敏感数据Subscriber
      if (this.options.autoRegisterSensitiveSubscriber) {
        const sensitiveSubscriber = this.createSensitiveDataSubscriber();
        dataSourceOptions.subscribers!.push(sensitiveSubscriber);
      }

      // 4. 初始化DataSource
      this.dataSource = this.createDataSource(dataSourceOptions);
      await this.dataSource.initialize();

      this.isInitialized = true;
      console.log('TypeORM集成初始化成功');
    } catch (error) {
      console.error('TypeORM集成初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建DataSource实例（需要宿主项目提供TypeORM）
   */
  private createDataSource(options: DataSourceOptions): DataSource {
    // 这里需要宿主项目提供TypeORM的DataSource
    // 在实际使用中，宿主项目需要传入DataSource构造函数
    throw new Error('需要宿主项目提供TypeORM DataSource，请使用setDataSourceFactory方法');
  }

  /**
   * 设置DataSource工厂函数
   */
  setDataSourceFactory(factory: (options: DataSourceOptions) => DataSource): void {
    this.createDataSource = factory;
  }

  /**
   * 获取DataSource实例
   */
  getDataSource(): DataSource {
    if (!this.isInitialized) {
      throw new Error('TypeORM集成尚未初始化，请先调用initialize()');
    }
    return this.dataSource;
  }

  /**
   * 获取敏感数据处理器
   */
  getSensitiveData(): SensitiveData {
    if (!this.isInitialized) {
      throw new Error('TypeORM集成尚未初始化，请先调用initialize()');
    }
    return this.sensitiveData;
  }

  /**
   * 创建敏感数据Subscriber
   */
  private createSensitiveDataSubscriber(): EntitySubscriberInterface {
    if (this.options.useAdvancedSubscriber) {
      return new AdvancedEncryptionSubscriber(this.sensitiveData, this.options.logger);
    } else {
      return new SensitiveDataSubscriber(
        this.sensitiveData,
        this.options.sensitiveFields
      );
    }
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    if (this.dataSource && this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
    this.isInitialized = false;
  }
}

/**
 * 敏感数据Subscriber（基础版本）
 */
class SensitiveDataSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;
  private entityConfigs: Map<any, string[]>;

  constructor(sensitiveData: SensitiveData, entityConfigs?: Map<any, string[]>) {
    this.sensitiveData = sensitiveData;
    this.entityConfigs = entityConfigs || new Map();
  }

  listenTo(): any[] {
    return Array.from(this.entityConfigs.keys());
  }

  beforeInsert(event: InsertEvent<any>): void {
    const entityType = event.entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.encryptFields(event.entity, sensitiveFields);
    }
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    const entityType = event.entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.encryptFields(event.entity, sensitiveFields);
    }
  }

  afterLoad(entity: any): void {
    const entityType = entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.decryptFields(entity, sensitiveFields);
    }
  }

  private encryptFields(entity: any, fields: string[]): void {
    for (const field of fields) {
      if (entity[field] && typeof entity[field] === 'string') {
        entity[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(entity[field]);
      }
    }
  }

  private decryptFields(entity: any, fields: string[]): void {
    for (const field of fields) {
      if (entity[field] && typeof entity[field] === 'string') {
        entity[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(entity[field]);
      }
    }
  }
}

/**
 * 便捷的装饰器工厂函数
 */
export function createSensitiveFieldDecorator() {
  return function(target: any, propertyKey: string) {
    if (!target.constructor.sensitiveFields) {
      target.constructor.sensitiveFields = [];
    }
    target.constructor.sensitiveFields.push(propertyKey);
  };
}

// 导出高级装饰器
export { createEncryptedFieldDecorator, createEncryptedJsonFieldDecorator };

/**
 * 便捷的配置构建器
 */
export class TypeORMIntegrationBuilder {
  private options: Partial<TypeORMIntegrationOptions> = {};

  setDatabase(database: DataSourceOptions): this {
    this.options.database = database;
    return this;
  }

  setNacos(nacos: TypeORMIntegrationOptions['nacos']): this {
    this.options.nacos = nacos;
    return this;
  }

  setEncryptedConfig(encryptedConfigDataId: string, encryptedConfigGroup?: string): this {
    this.options.encryptedConfigDataId = encryptedConfigDataId;
    this.options.encryptedConfigGroup = encryptedConfigGroup;
    return this;
  }

  setEntities(entities: any[]): this {
    this.options.entities = entities;
    return this;
  }

  setSensitiveFields(sensitiveFields: Map<any, string[]>): this {
    this.options.sensitiveFields = sensitiveFields;
    return this;
  }

  setAutoRegisterSensitiveSubscriber(autoRegister: boolean): this {
    this.options.autoRegisterSensitiveSubscriber = autoRegister;
    return this;
  }

  setUseAdvancedSubscriber(useAdvanced: boolean): this {
    this.options.useAdvancedSubscriber = useAdvanced;
    return this;
  }

  setLogger(logger: any): this {
    this.options.logger = logger;
    return this;
  }

  build(): TypeORMIntegration {
    if (!this.options.database) {
      throw new Error('数据库配置是必需的');
    }
    if (!this.options.nacos) {
      throw new Error('Nacos配置是必需的');
    }
    if (!this.options.encryptedConfigDataId) {
      throw new Error('加密配置ID是必需的');
    }
    if (!this.options.entities) {
      throw new Error('实体配置是必需的');
    }

    return new TypeORMIntegration(this.options as TypeORMIntegrationOptions);
  }
} 