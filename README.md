# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密算法、TypeORM字段装饰器和哈希字段功能

## 更新日志

### v1.4.0
- 🔄 **Hash重构**：`HashUtil`→`Hash`，将原来的`sha256`方法拆分为`sha256`（纯哈希）和`normalizeSha256`（标准化哈希）
- 📝 **方法重命名**：`verifySha256`重命名为`verify`，新增`verifyNormalized`方法
- 🔧 **API简化**：`SensitiveData`→`Encryption`，`initSensitiveKey`→`init`，`aes128Sha256EncryptSensitiveData`→`encrypt`，`aes128Sha256DecryptSensitiveData`→`decrypt`
- ⚠️ **破坏性变更**：原来使用`HashUtil.sha256`的地方需要改为`Hash.normalizeSha256`以保持相同功能

### v1.3.0
- 🔒 **安全性改进**：核心加密方法失败时抛出异常而非返回空字符串，避免数据丢失风险
- 🛡️ **异常处理优化**：TypeORM订阅器自动捕获解密异常并保持原值
- ⚡ **空值处理**：默认跳过null、undefined、空字符串的加解密操作，符合行业最佳实践

### v1.2.0
- ✨ 新增JSON字段加密功能，支持复杂嵌套对象和数组
- 🔧 优化TypeORM集成，支持自动加密解密

### v1.1.0
- 🎯 新增哈希字段功能
- 📦 完善TypeScript类型定义

### v1.0.0
- 🚀 初始版本发布

## 核心功能

- **AES-128-SHA256 加密算法**：高性能的敏感数据加密解密
- **TypeORM 字段装饰器**：`@EncryptedField`、`@EncryptedJsonField`、`@HashField`
- **自动加密解密**：基于TypeORM订阅器实现字段自动处理
- **复杂JSON路径支持**：支持嵌套对象、数组、根数组等复杂场景
- **哈希字段功能**：自动生成SHA256哈希字段用于数据完整性验证
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
```

### 基础使用

```typescript
import { Encryption, Hash, EncryptedField, HashField } from 'ankerutil-node';

// 敏感数据加密
const encryption = new Encryption();
const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const rootKey = { "0001": "0123456789abcdef0123456789abcdef" };
encryption.init(cbcKey, rootKey);

const encrypted = encryption.encrypt("敏感数据");
const decrypted = encryption.decrypt(encrypted);

// 哈希工具
const hash = Hash.normalizeSha256("Hello, World!");
const isValid = Hash.verifyNormalized("Hello, World!", hash);

// TypeORM实体装饰器
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @EncryptedField()
  @HashField()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  email_sha256: string;
}
```

### TypeORM 集成

```typescript
import { EncryptedField, EncryptedJsonField, EncryptionSubscriber } from 'ankerutil-node';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @EncryptedField()
  email: string;

  // JSON字段加密 - 嵌套对象
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: ['name', 'idCard', 'contactInfo.email', 'contactInfo.phone']
  })
  @Column({ type: 'jsonb', nullable: true })
  personalInfo: {
    name: string;
    idCard: string;
    contactInfo: {
      email: string;
      phone: string;
    };
  };

  // JSON字段加密 - 数组
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: ['[].street', '[].city', '[].contacts[].email']
  })
  @Column({ type: 'jsonb', nullable: true })
  addresses: Array<{
    street: string;
    city: string;
    contacts: Array<{
      email: string;
    }>;
  }>;
}

// 注册订阅器
const encryption = new Encryption();
encryption.init(cbcKey, rootKey);
TypeOrmModule.forRoot({
  subscribers: [new EncryptionSubscriber(encryption, logger)]
});
```

## API

### Encryption

```typescript
class Encryption {
  init(cbcKey: string, rootKey: { [version: string]: string }): void;
  encrypt(text: string): string;
  decrypt(encryptedText: string): string;
}
```

### Hash

```typescript
class Hash {
  static sha256(text: string, encoding?: 'hex' | 'base64'): string;
  static normalizeSha256(text: string, encoding?: 'hex' | 'base64'): string;
  static verify(text: string, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
  static verifyNormalized(text: string, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
}
```