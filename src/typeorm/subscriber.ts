import { SensitiveData } from '../sensitive';
import { 
  EncryptedFieldOptions, 
  getEncryptedFields,
  EncryptionError as FieldEncryptionError
} from './field';
import {
  EncryptedJsonFieldOptions, 
  PathSegment, 
  parsePath,
  getEncryptedJsonFields,
  EncryptionError as JsonEncryptionError
} from './json';

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
 * 加密Subscriber
 * 支持普通字段和JSON路径加密
 */
export class EncryptionSubscriber implements EntitySubscriberInterface {
  private static encryptionService: SensitiveData;
  private logger: any;

  constructor(encryptionService?: SensitiveData, logger?: any) {
    if (encryptionService) {
      EncryptionSubscriber.encryptionService = encryptionService;
    }
    this.logger = logger || console;
  }

  /**
   * 加密普通字段
   */
  private async encryptField(entity: any, field: string, options: EncryptedFieldOptions): Promise<void> {
    if (!options.autoEncrypt || entity[field] == null) return;
    
    try {
      entity[field] = EncryptionSubscriber.encryptionService.aes128Sha256EncryptSensitiveData(String(entity[field]));
    } catch (error) {
      throw new FieldEncryptionError(
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
      const decryptedValue = EncryptionSubscriber.encryptionService.aes128Sha256DecryptSensitiveData(String(originalValue));
      
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
   * 处理JSON路径 - 基于老代码优化
   * 支持嵌套数组和对象，能正确处理如 'addresses[].contacts[].email' 这样的复杂路径
   * 支持明文和密文的混合处理
   */
  private async processJsonPath(
    obj: any,
    segments: PathSegment[],
    currentPath: string,
    operation: 'encrypt' | 'decrypt',
  ): Promise<void> {
    if (!obj || segments.length === 0) return;
    
    const [segment, ...remainingSegments] = segments;
    const newPath = currentPath ? `${currentPath}.${segment.key}` : segment.key;

    // 处理数组场景
    if (segment.isArray) {
      // 根数组处理
      if (segment.isRootArray) {
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            await this.processJsonPath(obj[i], remainingSegments, `[${i}]`, operation);
          }
        } else {
          this.logger.warn(`期望数组但在路径 '${currentPath}' 处找到 ${typeof obj}`);
        }
      } else {
        // 普通数组处理
        const array = obj[segment.key];
        if (Array.isArray(array)) {
          for (let i = 0; i < array.length; i++) {
            await this.processJsonPath(array[i], remainingSegments, `${newPath}[${i}]`, operation);
          }
        } else {
          this.logger.warn(`期望数组但在路径 '${newPath}' 处找到 ${typeof array}`);
        }
      }
    }
    // 处理对象场景
    else {
      const value = obj[segment.key];

      // 如果是叶节点且值是字符串，执行加密/解密
      if (remainingSegments.length === 0 && typeof value === 'string') {
        try {
          if (operation === 'encrypt') {
            obj[segment.key] = EncryptionSubscriber.encryptionService.aes128Sha256EncryptSensitiveData(value);
          } else {
            // 解密时，支持明文和密文
            const decryptedValue = EncryptionSubscriber.encryptionService.aes128Sha256DecryptSensitiveData(value);
            // 只有在解密后的值不为空时才更新
            if (decryptedValue !== null && decryptedValue !== undefined && decryptedValue !== '') {
              obj[segment.key] = decryptedValue;
            } else {
              // 如果解密后为空，保持原值
              this.logger.warn(`解密结果为空，保持原值，路径: '${newPath}'`);
            }
          }
        } catch (error) {
          // 如果是解密错误，记录警告但继续处理
          if (operation === 'decrypt') {
            this.logger.warn(
              `解密失败，可能是明文数据，路径: '${newPath}', 错误: ${error instanceof Error ? error.message : String(error)}`,
            );
            // 保持原值不变，继续处理其他字段
            return;
          }
          throw new JsonEncryptionError(
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
  public async processNestedFields(obj: any, paths: string[], operation: 'encrypt' | 'decrypt'): Promise<void> {
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
      await this.processNestedFields(fieldValue, options.paths, 'encrypt');
    } catch (error) {
      if (error instanceof JsonEncryptionError) throw error;
      throw new JsonEncryptionError(
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
      await this.processNestedFields(fieldValue, options.paths, 'decrypt');
    } catch (error) {
      if (error instanceof JsonEncryptionError) throw error;
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
    if (error instanceof FieldEncryptionError || error instanceof JsonEncryptionError) {
      // 如果是解密错误，记录警告但继续处理
      if (operation === 'decrypt') {
        this.logger.warn(
          `解密失败，可能是明文数据，字段: ${error.field}, 路径: ${error.path || 'N/A'}, 错误: ${error.message}`,
        );
        return;
      }
      throw error;
    }
    throw new FieldEncryptionError(
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

    if (!EncryptionSubscriber.encryptionService) {
      throw new FieldEncryptionError('Encryption service not initialized', 'encryption', 'encrypt');
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

    if (!EncryptionSubscriber.encryptionService) {
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
