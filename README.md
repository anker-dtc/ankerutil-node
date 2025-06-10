# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密算法和TypeORM字段装饰器

## 核心功能

- **AES-128-SHA256 加密算法**：高性能的敏感数据加密解密
- **TypeORM 字段装饰器**：`@EncryptedField` 和 `@EncryptedJsonField`
- **自动加密解密**：基于TypeORM订阅器实现字段自动处理
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
```

### 基础使用

```typescript
import { SensitiveData } from 'ankerutil-node';

const sensitiveData = new SensitiveData();
const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const rootKey = {
  "0001": "0123456789abcdef0123456789abcdef"
};
sensitiveData.initSensitiveKey(cbcKey, rootKey);

const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData("敏感数据");
const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
```

### TypeORM 集成

```typescript
import { EncryptedField, EncryptedJsonField, AdvancedEncryptionSubscriber } from 'ankerutil-node';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @EncryptedField()
  email: string;

  @EncryptedJsonField({ paths: ['profile.phone', 'profile.address'] })
  profile: any;
}

// 注册订阅器
const sensitiveData = new SensitiveData();
sensitiveData.initSensitiveKey(cbcKey, rootKey);
TypeOrmModule.forRoot({
  // ... 数据库配置
  subscribers: [
    new AdvancedEncryptionSubscriber(sensitiveData, logger)
  ]
});
```

## API

### SensitiveData

```typescript
class SensitiveData {
  initSensitiveKey(cbcKey: string, rootKey: { [version: string]: string }): void;
  aes128Sha256EncryptSensitiveData(text: string): string;
  aes128Sha256DecryptSensitiveData(encryptedText: string): string;
}
```

### 装饰器

#### @EncryptedField

```typescript
@EncryptedField(options?: { autoEncrypt?: boolean })
email: string;
```

#### @EncryptedJsonField

```typescript
@EncryptedJsonField({
  paths: ['profile.phone', 'profile.address'],
  autoEncrypt?: boolean
})
profile: any;
```

### 订阅器

#### AdvancedEncryptionSubscriber

```typescript
const subscriber = new AdvancedEncryptionSubscriber(sensitiveData, logger);
```

## 环境要求

- Node.js >= 18.0.0
- TypeScript >= 5.0.0（推荐）
- TypeORM >= 0.2.0（如需装饰器功能）

## 许可证

MIT License