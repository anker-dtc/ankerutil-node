import { SensitiveData } from '../sensitive';

// 类型定义
export interface EncryptedFieldOptions {
  autoEncrypt?: boolean;
  [key: string]: any;
}

export interface EncryptedJsonFieldOptions {
  autoEncrypt?: boolean;
  paths: string[];
  [key: string]: any;
}

export interface PathSegment {
  key: string;
  isArray: boolean;
}

export class EncryptionError extends Error {
  constructor(
    message: string,
    public field: string,
    public operation: 'encrypt' | 'decrypt',
    public path?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

// 路径解析器
function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let current = '';
  let inBrackets = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '[') {
      if (current) {
        segments.push({ key: current, isArray: false });
        current = '';
      }
      inBrackets = true;
    } else if (char === ']') {
      segments.push({ key: current || '0', isArray: true });
      current = '';
      inBrackets = false;
    } else if (char === '.' && !inBrackets) {
      if (current) {
        segments.push({ key: current, isArray: false });
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    segments.push({ key: current, isArray: false });
  }

  return segments;
}

// 获取加密字段配置
function getEncryptedFields(entityConstructor: any): Array<{ field: string; options: EncryptedFieldOptions }> {
  const fields: Array<{ field: string; options: EncryptedFieldOptions }> = [];
  
  // 从装饰器元数据中获取字段配置
  if (entityConstructor.encryptedFields) {
    return entityConstructor.encryptedFields;
  }

  // 从静态属性中获取
  if (entityConstructor.__encryptedFields) {
    return entityConstructor.__encryptedFields;
  }

  return fields;
}

// 获取加密JSON字段配置
function getEncryptedJsonFields(entityConstructor: any): Array<{ field: string; options: EncryptedJsonFieldOptions }> {
  const fields: Array<{ field: string; options: EncryptedJsonFieldOptions }> = [];
  
  // 从装饰器元数据中获取字段配置
  if (entityConstructor.encryptedJsonFields) {
    return entityConstructor.encryptedJsonFields;
  }

  // 从静态属性中获取
  if (entityConstructor.__encryptedJsonFields) {
    return entityConstructor.__encryptedJsonFields;
  }

  return fields;
}

// TypeORM接口定义
interface EntitySubscriberInterface {
  listenTo?(): any;
  beforeInsert?(event: InsertEvent<any>): void;
  beforeUpdate?(event: UpdateEvent<any>): void;
  afterLoad?(entity: any): void;
}

interface InsertEvent<T> {
  entity: T;
}

interface UpdateEvent<T> {
  entity: T;
}

/**
 * 高级加密Subscriber
 * 支持普通字段和JSON路径加密
 */
export class AdvancedEncryptionSubscriber implements EntitySubscriberInterface {
  private static encryptionService: SensitiveData;
  private logger: any;

  constructor(encryptionService?: SensitiveData, logger?: any) {
    if (encryptionService) {
      AdvancedEncryptionSubscriber.encryptionService = encryptionService;
    }
    this.logger = logger || console;
  }

  /**
   * 加密普通字段
   */
  private async encryptField(entity: any, field: string, options: EncryptedFieldOptions): Promise<void> {
    if (!options.autoEncrypt || entity[field] == null) return;
    
    try {
      entity[field] = AdvancedEncryptionSubscriber.encryptionService.aes128Sha256EncryptSensitiveData(String(entity[field]));
    } catch (error) {
      throw new EncryptionError(
        `Failed to encrypt field: ${error instanceof Error ? error.message : String(error)}`, 
        field, 
        'encrypt', 
        undefined, 
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 解密普通字段
   */
  private async decryptField(entity: any, field: string, options: EncryptedFieldOptions): Promise<void> {
    if (entity[field] == null) return;
    
    const originalValue = entity[field];
    try {
      const decryptedValue = AdvancedEncryptionSubscriber.encryptionService.aes128Sha256DecryptSensitiveData(String(originalValue));
      
      // 只有在解密后的值不为空时才更新
      if (decryptedValue !== null && decryptedValue !== undefined && decryptedValue !== '') {
        entity[field] = decryptedValue;
      } else {
        // 如果解密后为空，保持原值
        entity[field] = originalValue;
        this.logger.warn(`解密结果为空，保持原值，字段: ${field}`);
      }
    } catch (error) {
      // 解密失败时保持原值
      entity[field] = originalValue;
      this.logger.warn(`解密失败，保持原值，字段: ${field}, 错误: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 处理JSON路径
   */
  private async processJsonPath(
    obj: any,
    segments: PathSegment[],
    currentPath: string,
    operation: 'encrypt' | 'decrypt',
  ): Promise<void> {
    const [segment, ...remainingSegments] = segments;
    const newPath = currentPath ? `${currentPath}.${segment.key}` : segment.key;

    // 处理数组场景
    if (segment.isArray) {
      const array = obj[segment.key];
      if (Array.isArray(array)) {
        for (let i = 0; i < array.length; i++) {
          await this.processJsonPath(array[i], remainingSegments, `${newPath}[${i}]`, operation);
        }
      } else {
        this.logger.warn(`期望数组但在路径 '${newPath}' 处找到 ${typeof array}`);
      }
    }
    // 处理对象场景
    else {
      const value = obj[segment.key];

      // 如果是叶节点且值是字符串，执行加密/解密
      if (remainingSegments.length === 0 && typeof value === 'string') {
        try {
          if (operation === 'encrypt') {
            obj[segment.key] = AdvancedEncryptionSubscriber.encryptionService.aes128Sha256EncryptSensitiveData(value);
          } else {
            // 解密时，支持明文和密文
            obj[segment.key] = AdvancedEncryptionSubscriber.encryptionService.aes128Sha256DecryptSensitiveData(value);
          }
        } catch (error) {
          // 如果是解密错误，记录警告但继续处理
          if (operation === 'decrypt') {
            this.logger.warn(
              `解密失败，可能是明文数据，路径: '${newPath}', 错误: ${error instanceof Error ? error.message : String(error)}`,
            );
            // 保持原值不变
            return;
          }
          throw new EncryptionError(
            `Failed to ${operation} field at path '${newPath}'`,
            'json',
            operation,
            newPath,
            error instanceof Error ? error : undefined,
          );
        }
      }
      // 如果有更多段且当前值是对象，则递归处理
      else if (remainingSegments.length > 0 && typeof value === 'object' && value !== null) {
        await this.processJsonPath(value, remainingSegments, newPath, operation);
      }
    }
  }

  /**
   * 处理嵌套字段
   */
  private async processNestedFields(obj: any, paths: string[], operation: 'encrypt' | 'decrypt'): Promise<void> {
    for (const path of paths) {
      try {
        const segments = parsePath(path);
        await this.processJsonPath(obj, segments, '', operation);
      } catch (error) {
        throw error;
      }
    }
  }

  /**
   * 加密JSON字段
   */
  private async encryptJsonField(entity: any, field: string, options: EncryptedJsonFieldOptions): Promise<void> {
    if (!options.autoEncrypt || entity[field] == null) return;
    
    try {
      const fieldValue = entity[field];
      const hasRootArrayPaths = options.paths.some(path => path.startsWith('[]'));

      if (Array.isArray(fieldValue) && hasRootArrayPaths) {
        const rootArrayPaths = options.paths
          .filter(path => path.startsWith('[]'))
          .map(path => path.substring(path.startsWith('[].') ? 3 : 2));

        const regularPaths = options.paths.filter(path => !path.startsWith('[]'));

        if (rootArrayPaths.length > 0) {
          for (let i = 0; i < fieldValue.length; i++) {
            const item = fieldValue[i];
            if (typeof item === 'object' && item !== null) {
              await this.processNestedFields(item, rootArrayPaths, 'encrypt');
            }
          }
        }

        if (regularPaths.length > 0) {
          await this.processNestedFields(fieldValue, regularPaths, 'encrypt');
        }
      } else {
        await this.processNestedFields(fieldValue, options.paths, 'encrypt');
      }
    } catch (error) {
      if (error instanceof EncryptionError) throw error;
      throw new EncryptionError(
        `Failed to encrypt JSON field: ${error instanceof Error ? error.message : String(error)}`,
        field,
        'encrypt',
        undefined,
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * 解密JSON字段
   */
  private async decryptJsonField(entity: any, field: string, options: EncryptedJsonFieldOptions): Promise<void> {
    if (entity[field] == null) return;
    
    try {
      const fieldValue = entity[field];
      const hasRootArrayPaths = options.paths.some(path => path.startsWith('[]'));

      if (Array.isArray(fieldValue) && hasRootArrayPaths) {
        const rootArrayPaths = options.paths
          .filter(path => path.startsWith('[]'))
          .map(path => path.substring(path.startsWith('[].') ? 3 : 2));

        const regularPaths = options.paths.filter(path => !path.startsWith('[]'));

        if (rootArrayPaths.length > 0) {
          for (let i = 0; i < fieldValue.length; i++) {
            const item = fieldValue[i];
            if (typeof item === 'object' && item !== null) {
              await this.processNestedFields(item, rootArrayPaths, 'decrypt');
            }
          }
        }

        if (regularPaths.length > 0) {
          await this.processNestedFields(fieldValue, regularPaths, 'decrypt');
        }
      } else {
        await this.processNestedFields(fieldValue, options.paths, 'decrypt');
      }
    } catch (error) {
      if (error instanceof EncryptionError) throw error;
      // 解密失败时保持原值
      this.logger.warn(
        `解密失败，可能是明文数据，字段: ${field}, 错误: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 处理加密错误
   */
  private handleEncryptionError(error: any, operation: 'encrypt' | 'decrypt'): void {
    if (error instanceof EncryptionError) {
      // 如果是解密错误，记录警告但继续处理
      if (operation === 'decrypt') {
        this.logger.warn(
          `解密失败，可能是明文数据，字段: ${error.field}, 路径: ${error.path || 'N/A'}, 错误: ${error.message}`,
        );
        return;
      }
      throw error;
    }
    throw new EncryptionError(
      `Unexpected error during ${operation}: ${error instanceof Error ? error.message : String(error)}`,
      'unknown',
      operation,
      undefined,
      error instanceof Error ? error : undefined,
    );
  }

  /**
   * 插入前加密
   */
  async beforeInsert(event: InsertEvent<any>): Promise<void> {
    const entity = event.entity;
    if (!entity) return;

    if (!AdvancedEncryptionSubscriber.encryptionService) {
      throw new EncryptionError('Encryption service not initialized', 'encryption', 'encrypt');
    }

    const encryptedFields = getEncryptedFields(entity.constructor);
    for (const { field, options } of encryptedFields) {
      try {
        await this.encryptField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }

    const encryptedJsonFields = getEncryptedJsonFields(entity.constructor);
    for (const { field, options } of encryptedJsonFields) {
      try {
        await this.encryptJsonField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }
  }

  /**
   * 加载后解密
   */
  async afterLoad(entity: any): Promise<void> {
    if (!entity) return;

    if (!AdvancedEncryptionSubscriber.encryptionService) {
      return;
    }

    const encryptedFields = getEncryptedFields(entity.constructor);
    for (const { field, options } of encryptedFields) {
      try {
        await this.decryptField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'decrypt');
      }
    }

    const encryptedJsonFields = getEncryptedJsonFields(entity.constructor);
    for (const { field, options } of encryptedJsonFields) {
      try {
        await this.decryptJsonField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'decrypt');
      }
    }
  }

  /**
   * 更新前加密
   */
  async beforeUpdate(event: UpdateEvent<any>): Promise<void> {
    const entity = event.entity;
    if (!entity) return;

    const encryptedFields = getEncryptedFields(entity.constructor);
    for (const { field, options } of encryptedFields) {
      try {
        await this.encryptField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }

    const encryptedJsonFields = getEncryptedJsonFields(entity.constructor);
    for (const { field, options } of encryptedJsonFields) {
      try {
        await this.encryptJsonField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }
  }
}

/**
 * 装饰器工厂函数
 */
export function createEncryptedFieldDecorator(options: EncryptedFieldOptions = {}) {
  return function(target: any, propertyKey: string) {
    if (!target.constructor.__encryptedFields) {
      target.constructor.__encryptedFields = [];
    }
    target.constructor.__encryptedFields.push({ field: propertyKey, options });
  };
}

export function createEncryptedJsonFieldDecorator(options: EncryptedJsonFieldOptions) {
  return function(target: any, propertyKey: string) {
    if (!target.constructor.__encryptedJsonFields) {
      target.constructor.__encryptedJsonFields = [];
    }
    target.constructor.__encryptedJsonFields.push({ field: propertyKey, options });
  };
}

// 装饰器别名导出
export const EncryptedField = createEncryptedFieldDecorator;
export const EncryptedJsonField = createEncryptedJsonFieldDecorator; 