# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密算法、TypeORM字段装饰器和哈希字段功能

## 更新日志

### v1.6.0
- ❌ **移除HashField装饰器**：哈希功能已集成到@EncryptedField/@EncryptedJsonField装饰器中
- 🛡️ **重复加密检测**：新增密文检测功能，避免对已经是密文的数据进行重复加密
- 🔐 **集成哈希生成**：加密装饰器支持自动生成哈希字段，确保哈希在加密前生成
- ⚡ **性能优化**：减少不必要的加密操作，提高系统性能

## 核心功能

- **AES-128-SHA256 加密算法**：高性能的敏感数据加密解密
- **TypeORM 字段装饰器**：`@EncryptedField`、`@EncryptedJsonField`
- **自动加密解密**：基于TypeORM订阅器实现字段自动处理
- **复杂JSON路径支持**：支持嵌套对象、数组等复杂场景
- **哈希字段功能**：自动生成SHA256哈希字段用于数据完整性验证
- **重复加密检测**：智能识别密文格式，避免重复加密
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
```

### 基础使用

```typescript
import { Encryption, Hash, EncryptedField } from 'ankerutil-node';

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

  @EncryptedField({
    hashField: 'email_hash',     // 指定哈希字段名，如果不指定则不生成哈希
    hashEncoding: 'hex'          // 哈希编码格式，默认hex
  })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  email_hash: string;            // 对应的哈希字段
}
```

### TypeORM 集成

```typescript
import { EncryptedField, EncryptedJsonField, EncryptionSubscriber } from 'ankerutil-node';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @EncryptedField({
    hashField: 'email_hash',     // 指定哈希字段名，如果不指定则不生成哈希
    hashEncoding: 'hex'          // 哈希编码格式，默认hex
  })
  email: string;

  // JSON字段加密 - 嵌套对象
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: ['name', 'idCard', 'contactInfo.email', 'contactInfo.phone'],
    hashField: 'personal_info_hash',  // 指定哈希字段名
    hashEncoding: 'base64'            // 哈希编码格式
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
    paths: ['[].street', '[].city', '[].contacts[].email'],
    hashField: 'addresses_hash',      // 指定哈希字段名
    hashEncoding: 'hex'               // 哈希编码格式
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
  encrypt(text: string | null | undefined): string | null;
  decrypt(encryptedText: string | null | undefined): string | null;
}
```

### Hash

```typescript
class Hash {
  static sha256(text: string | null | undefined, encoding?: 'hex' | 'base64'): string | null;
  static normalize(text: string | null | undefined): string | null;
  static normalizeSha256(text: string | null | undefined, encoding?: 'hex' | 'base64'): string | null;
  static verify(text: string | null | undefined, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
  static verifyNormalized(text: string | null | undefined, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
}
```

### 装饰器配置

#### EncryptedFieldOptions
```typescript
interface EncryptedFieldOptions {
  autoEncrypt?: boolean;  // 是否自动加密写入，默认true
  autoDecrypt?: boolean;  // 是否自动解密读取，默认true
  hashField?: string;     // 哈希字段名称，如果指定则会在加密前生成哈希
  hashEncoding?: 'hex' | 'base64'; // 哈希编码格式，默认hex
}
```

#### EncryptedJsonFieldOptions
```typescript
interface EncryptedJsonFieldOptions {
  autoEncrypt?: boolean;  // 是否自动加密写入，默认true
  autoDecrypt?: boolean;  // 是否自动解密读取，默认true
  paths: string[];        // 需要加密的JSON路径
  hashField?: string;     // 哈希字段名称，如果指定则会在加密前生成哈希
  hashEncoding?: 'hex' | 'base64'; // 哈希编码格式，默认hex
}
```