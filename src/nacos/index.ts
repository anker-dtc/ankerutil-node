/**
 * Nacos 配置读取模块
 * 提供基础 Nacos 客户端和增强版配置管理功能
 * 支持 Express.js 和 NestJS 项目直接使用
 */

// 导出敏感配置管理模块
export * from './secret-manager';

// 导出基础 Nacos 客户端
export * from './nacos-client';

// 导出增强版 Nacos 配置模块
export * from './enhanced-nacos';

// 默认导出增强版 Nacos 配置
export { EnhancedNacosConfig as default } from './enhanced-nacos';