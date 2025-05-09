# AnkerUtil-Node

Node.js 敏感数据加密工具库，提供 AES-128-CBC + SHA256 混合加密方案，支持多版本根密钥管理。

## 功能特性

- 混合加密方案：AES-128-CBC 数据加密 + SHA256 摘要验证
- 多版本根密钥支持
- 自动处理特殊字符和编码问题
- 完善的边界条件处理（空值/非法格式/超长数据）
- 提供 Ruby/Go 生成的密文互操作性支持

## 安装

```bash
npm install ankerutil-node
```

## 测试
```bash
npm test
```

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
```

## 许可证
MIT