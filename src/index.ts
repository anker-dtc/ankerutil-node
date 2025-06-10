// 导出敏感数据加密核心模块
export * from "./sensitive";

// 导出TypeORM字段装饰器
export * from "./typeorm/field";

// 导出TypeORM JSON装饰器（重命名EncryptionError以避免冲突）
export { 
  EncryptedJsonFieldOptions,
  PathSegment,
  parsePath,
  getEncryptedJsonFields,
  createEncryptedJsonFieldDecorator,
  EncryptedJsonField,
  EncryptionError as JsonEncryptionError
} from "./typeorm/json";

// 导出TypeORM订阅器
export * from "./typeorm/subscriber";
