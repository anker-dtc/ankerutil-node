# AnkerUtil-Node

Node.js 敏感数据加密工具库，提供 AES-128-CBC + SHA256 混合加密方案，支持多版本根密钥管理。

## 功能特性

- 混合加密方案：AES-128-CBC 数据加密 + SHA256 摘要验证
- 多版本根密钥支持：支持密钥版本管理和轮换
- 跨语言兼容：与 Go/Ruby 版本保持算法兼容性
- 自动处理特殊字符和编码问题
- 完善的边界条件处理（空值/非法格式/超长数据）
- 完整的单元测试覆盖

## 安装

```bash
npm install ankerutil-node
```

## 主要功能

### 1. 敏感数据加密
```javascript
// 初始化密钥
const cbcKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const rootKey = {
  '0001': '0123456789abcdef0123456789abcdef',  // 当前版本根密钥
  '0002': 'abcdef0123456789abcdef0123456789'   // 历史版本根密钥
};

const handler = new SensitiveData();
handler.initSensitiveKey(cbcKey, rootKey);

// 加密/解密
const encrypted = handler.aes128Sha256EncryptSensitiveData('Hello World');
const decrypted = handler.aes128Sha256DecryptSensitiveData(encrypted);
```

### 2. 边界条件处理
- 自动处理空值
- 处理非法格式数据
- 处理超长数据
- 处理特殊字符和编码问题

## 使用示例

```javascript
const { SensitiveData } = require('ankerutil-node');

// 初始化密钥（使用预生成密钥）
const cbcKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const rootKey = {
  '0001': '0123456789abcdef0123456789abcdef',  // 当前版本根密钥
  '0002': 'abcdef0123456789abcdef0123456789'   // 历史版本根密钥
};

const handler = new SensitiveData();
handler.initSensitiveKey(cbcKey, rootKey);

// 加密/解密
const encrypted = handler.aes128Sha256EncryptSensitiveData('Hello World');
const decrypted = handler.aes128Sha256DecryptSensitiveData(encrypted);
console.log(decrypted); // 输出: Hello World
```

## 测试
```bash
npm test
```

## 许可证
MIT