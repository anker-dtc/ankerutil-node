/**
 * 哈希字段装饰器配置
 */
export interface HashFieldOptions {
  fieldName?: string;       // 哈希字段名称
  encoding?: 'hex' | 'base64'; // 编码格式
}

/**
 * 哈希字段装饰器
 * 支持可选参数：
 * - 不传参数：自动生成哈希字段名（原字段名 + '_sha256'）
 * - 传字符串：指定哈希字段名
 * 默认使用hex编码
 */
export function HashField(hashFieldName?: string) {
  return function(target: any, propertyKey: string) {
    // 如果没有指定哈希字段名，自动生成
    const finalHashFieldName = hashFieldName || `${propertyKey}_sha256`;
    
    // 存储配置到元数据
    if (!target.constructor.__hashFields) {
      target.constructor.__hashFields = [];
    }
    target.constructor.__hashFields.push({
      field: propertyKey,
      hashFieldName: finalHashFieldName,
      encoding: 'hex' // 固定使用hex编码
    });
  };
}

/**
 * 获取哈希字段配置
 */
export function getHashFields(entityConstructor: any): Array<{ 
  field: string; 
  hashFieldName: string; 
  encoding: string; 
}> {
  return entityConstructor.__hashFields || [];
} 