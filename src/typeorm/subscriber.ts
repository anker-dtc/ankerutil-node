import { Encryption } from '../sensitive';
import { Hash } from '../hash';
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
  private static encryptionService: Encryption;
  private logger: any;

  constructor(encryptionService?: Encryption, logger?: any) {
    if (encryptionService) {
      EncryptionSubscriber.encryptionService = encryptionService;
    }
    this.logger = logger || console;
  }

  /**
   * 检测字符串是否已经是密文
   * 基于加密格式：version^envelopeKey^digest^secretData
   */
  private isAlreadyEncrypted(value: string): boolean {
    if (typeof value !== 'string' || !value.trim()) {
      return false;
    }

    try {
      const parts = value.split('^');
      
      // 新版密文格式：version^envelopeKey^digest^secretData (4个部分)
      if (parts.length === 4) {
        const [version, envelopeKey, digest, secretData] = parts;
        return version.length === 4 && // 版本号长度为4
               Boolean(envelopeKey) && Boolean(digest) && Boolean(secretData) && // 其他部分不为空
               envelopeKey.length > 0 && digest.length > 0 && secretData.length > 0;
      }
      
      // 旧版密文格式：version^secretData (2个部分)
      if (parts.length === 2) {
        const [version, secretData] = parts;
        return version === '0001' && Boolean(secretData) && secretData.length > 0;
      }
      
      return false;
    } catch (error) {
      this.logger.debug(`Ciphertext detection failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * 加密普通字段
   */
  private async encryptField(entity: any, field: string, options: EncryptedFieldOptions): Promise<void> {
    if (!options.autoEncrypt) return;
    
    const value = entity[field];
    
    if (value == null) {
      return;
    }
    
    const stringValue = String(value);
    if (this.isAlreadyEncrypted(stringValue)) {
      // Skip already encrypted field
      return;
    }
    
    // 在加密前生成哈希（如果配置了哈希字段）
    if (options.hashField) {
      try {
        const hashValue = Hash.normalizeSha256(stringValue, options.hashEncoding || 'hex');
        entity[options.hashField] = hashValue;
      } catch (hashError) {
        this.logger.warn(`Hash field generation failed: ${field} -> ${options.hashField}, error: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
      }
    }
    
    try {
      entity[field] = EncryptionSubscriber.encryptionService.encrypt(stringValue);
      // Field encrypted successfully
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
   * 生成哈希字段
   */
  private async generateHashField(entity: any, field: string, hashFieldName: string, encoding: string): Promise<void> {
    try {
      const hashValue = Hash.normalizeSha256(entity[field], encoding as 'hex' | 'base64');
      entity[hashFieldName] = hashValue;
      // Hash field generated successfully
    } catch (hashError) {
      this.logger.warn(`Hash field generation failed: ${field}, error: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
    }
  }

  /**
   * 解密普通字段
   */
  private async decryptField(entity: any, field: string, options: EncryptedFieldOptions): Promise<void> {
    if (!options.autoDecrypt) return;
    
    const value = entity[field];
    
    if (value == null) {
      return;
    }
    
    const originalValue = value;
    try {
      const decryptedValue = EncryptionSubscriber.encryptionService.decrypt(String(originalValue));
      entity[field] = decryptedValue;
      // Field decrypted successfully
    } catch (error) {
      entity[field] = originalValue;
      this.logger.warn(`Decryption failed, keeping original value: ${field}, error: ${error instanceof Error ? error.message : String(error)}`);
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
          this.logger.warn(`Expected array at path '${currentPath}', found ${typeof obj}`);
        }
      } else {
        const array = obj[segment.key];
        if (Array.isArray(array)) {
          for (let i = 0; i < array.length; i++) {
            await this.processJsonPath(array[i], remainingSegments, `${newPath}[${i}]`, operation);
          }
        } else {
          this.logger.warn(`Expected array at path '${newPath}', found ${typeof array}`);
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
            if (this.isAlreadyEncrypted(value)) {
              // Skip already encrypted JSON path
              return;
            }
            obj[segment.key] = EncryptionSubscriber.encryptionService.encrypt(value);
          } else {
            const decryptedValue = EncryptionSubscriber.encryptionService.decrypt(value);
            obj[segment.key] = decryptedValue;
          }
        } catch (error) {
          if (operation === 'decrypt') {
            this.logger.warn(
              `Decryption failed, may be plaintext: ${newPath}, error: ${error instanceof Error ? error.message : String(error)}`,
            );
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
    if (!options.autoEncrypt) return;
    
    const value = entity[field];
    
    if (value == null) {
      return;
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return;
    }
    
    // 在加密前生成哈希（如果配置了哈希字段）
    if (options.hashField) {
      try {
        // 对于JSON字段，我们基于整个JSON对象生成哈希
        const jsonString = JSON.stringify(value);
        const hashValue = Hash.normalizeSha256(jsonString, options.hashEncoding || 'hex');
        entity[options.hashField] = hashValue;
      } catch (hashError) {
        this.logger.warn(`Hash field generation failed: ${field} -> ${options.hashField}, error: ${hashError instanceof Error ? hashError.message : String(hashError)}`);
      }
    }
    
    try {
      await this.processNestedFields(value, options.paths, 'encrypt');
      // JSON field encrypted successfully
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
    if (!options.autoDecrypt) return;
    
    const value = entity[field];
    
    if (value == null) {
      return;
    }
    
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return;
    }
    
    try {
      await this.processNestedFields(value, options.paths, 'decrypt');
      // JSON field decrypted successfully
    } catch (error) {
      if (error instanceof JsonEncryptionError) throw error;
      this.logger.warn(
        `JSON decryption failed, may be plaintext: ${field}, error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 处理加密错误
   */
  private handleEncryptionError(error: any, operation: 'encrypt' | 'decrypt'): void {
    if (error instanceof FieldEncryptionError || error instanceof JsonEncryptionError) {
      if (operation === 'decrypt') {
        this.logger.warn(
          `Decryption failed, may be plaintext: ${error.field}, path: ${error.path || 'N/A'}, error: ${error.message}`,
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

    // 处理加密字段
    const encryptedFields = getEncryptedFields(entity.constructor);
    for (const { field, options } of encryptedFields) {
      try {
        await this.encryptField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }

    // 处理JSON加密字段
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

    // 处理加密字段
    const encryptedFields = getEncryptedFields(entity.constructor);
    for (const { field, options } of encryptedFields) {
      try {
        await this.encryptField(entity, field, options);
      } catch (error) {
        this.handleEncryptionError(error, 'encrypt');
      }
    }

    // 处理JSON加密字段
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
