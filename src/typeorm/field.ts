// 普通字段加密相关类型定义
export interface EncryptedFieldOptions {
  autoEncrypt?: boolean;
  [key: string]: any;
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

// 获取加密字段配置
export function getEncryptedFields(entityConstructor: any): Array<{ field: string; options: EncryptedFieldOptions }> {
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

// 装饰器别名导出
export const EncryptedField = createEncryptedFieldDecorator;
