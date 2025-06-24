# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2024-12-19

### Added
- ✨ 新增哈希字段功能：`@HashField`装饰器
- ✨ 新增`HashUtil`工具类，提供SHA256哈希计算和验证
- ✨ 支持自动生成哈希字段名（原字段名 + '_sha256'）

### Changed
- 🏗️ 优化目录结构，将`src/utils/hash.ts`移动到`src/hash/index.ts`
- 🔄 保持`SensitiveData`类名向后兼容，同时提供`EncryptionUtil`别名

### Fixed
- 🐛 修正`@EncryptedField`设计，保持单一职责
- 🐛 修正订阅器逻辑，正确处理独立的`@HashField`装饰器

## [1.0.0] - 2024-12-01

### Added
- ✨ 初始版本发布
- ✨ 支持基础字段加密`@EncryptedField`
- ✨ 支持JSON字段加密`@EncryptedJsonField`
- ✨ 支持复杂路径解析和数组处理 