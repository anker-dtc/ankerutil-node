// JSON字段加密相关类型定义
export interface EncryptedJsonFieldOptions {
  autoEncrypt?: boolean;  // 是否自动加密写入，默认true
  autoDecrypt?: boolean;  // 是否自动解密读取，默认true
  paths: string[];
  [key: string]: any;
}

export interface PathSegment {
  key: string;
  isArray: boolean;
  isRootArray?: boolean;
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

// 路径解析器 - 基于老代码优化
export function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = [];
  let currentKey = '';
  let isParsingArray = false;

  // 检查是否以 [] 开头（根数组标记）
  if (path.startsWith('[]')) {
    segments.push({ key: '', isArray: true, isRootArray: true });
    // 如果只有 []，则返回
    if (path === '[]') {
      return segments;
    }
    // 否则跳过 [] 部分，处理后面的路径（通常是 [].xxx 格式）
    path = path.substring(2);
    // 如果有点，跳过
    if (path.startsWith('.')) {
      path = path.substring(1);
    }
  }

  for (let i = 0; i < path.length; i++) {
    const char = path[i];

    if (char === '[') {
      // 处理数组开始标记
      if (currentKey) {
        // 找到新的数组段，标记为数组
        segments.push({ key: currentKey, isArray: true });
        currentKey = '';
      } else if (segments.length > 0 && !isParsingArray) {
        // 如果当前没有键但有前一个段，将前一个段修改为数组段
        const lastSegment = segments[segments.length - 1];
        segments[segments.length - 1] = { key: lastSegment.key, isArray: true };
      }
      isParsingArray = true;
    } else if (char === ']') {
      // 处理数组结束标记
      if (currentKey) {
        // 如果括号内有内容（如数字索引），暂不处理，后续可扩展
        currentKey = '';
      }
      isParsingArray = false;
    } else if (char === '.' && !isParsingArray) {
      // 处理点分隔符（不在数组括号内）
      if (currentKey) {
        segments.push({ key: currentKey, isArray: false });
        currentKey = '';
      }
    } else {
      // 处理普通字符
      currentKey += char;
    }
  }

  // 处理结尾部分
  if (currentKey) {
    segments.push({ key: currentKey, isArray: false });
  }

  // 验证所有段都有键，但对于根数组标记允许空键
  if (segments.some(segment => !segment.key && !segment.isRootArray)) {
    throw new Error(`Invalid path format: ${path}`);
  }

  return segments;
}

// 获取加密JSON字段配置
export function getEncryptedJsonFields(entityConstructor: any): Array<{ field: string; options: EncryptedJsonFieldOptions }> {
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

/**
 * 装饰器工厂函数
 */
export function createEncryptedJsonFieldDecorator(options: EncryptedJsonFieldOptions) {
  return function(target: any, propertyKey: string) {
    if (!target.constructor.__encryptedJsonFields) {
      target.constructor.__encryptedJsonFields = [];
    }
    // 设置默认值：autoEncrypt和autoDecrypt默认为true
    const finalOptions = { autoEncrypt: true, autoDecrypt: true, ...options };
    target.constructor.__encryptedJsonFields.push({ field: propertyKey, options: finalOptions });
  };
}

// 装饰器别名导出
export const EncryptedJsonField = createEncryptedJsonFieldDecorator;
