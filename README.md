# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密算法、TypeORM字段装饰器和哈希字段功能

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
import { SensitiveData, HashUtil, EncryptedField, HashField } from 'ankerutil-node';

// 敏感数据加密
const sensitiveData = new SensitiveData();
const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const rootKey = { "0001": "0123456789abcdef0123456789abcdef" };
sensitiveData.initSensitiveKey(cbcKey, rootKey);

const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData("敏感数据");
const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);

// 哈希工具
const hash = HashUtil.sha256("Hello, World!");
const isValid = HashUtil.verifySha256("Hello, World!", hash);

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
const sensitiveData = new SensitiveData();
sensitiveData.initSensitiveKey(cbcKey, rootKey);
TypeOrmModule.forRoot({
  subscribers: [new EncryptionSubscriber(sensitiveData, logger)]
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

### HashUtil

```typescript
class HashUtil {
  static sha256(text: string, encoding?: 'hex' | 'base64'): string;
  static verifySha256(text: string, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
}
```

### 装饰器

#### @EncryptedField

```typescript
@EncryptedField(options?: { autoEncrypt?: boolean })
email: string;
```

#### @HashField

```typescript
@HashField(hashFieldName?: string)
email: string;
```

**参数说明**：
- `hashFieldName` (可选)：哈希字段名称
  - 不传参数：自动生成哈希字段名（原字段名 + '_sha256'）
  - 传字符串：使用指定的哈希字段名

#### @EncryptedJsonField

```typescript
@EncryptedJsonField(options: {
  autoEncrypt?: boolean;
  paths: string[];
})
personalInfo: any;
```

**支持的路径格式**：
- 普通对象：`['name', 'contactInfo.email']`
- 根数组：`['[].street', '[].city']`
- 嵌套数组：`['addresses[].street', 'addresses[].contacts[].email']`

## 使用示例

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @EncryptedField()
  @HashField()
  email: string;

  @EncryptedField()
  @HashField('phoneHash')
  phone: string;

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

  @Column({ type: 'varchar', nullable: true })
  email_sha256: string;

  @Column({ type: 'varchar', nullable: true })
  phoneHash: string;
}
```

## 许可证

MIT