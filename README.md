# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密算法和TypeORM字段装饰器

## 核心功能

- **AES-128-SHA256 加密算法**：高性能的敏感数据加密解密
- **TypeORM 字段装饰器**：`@EncryptedField` 和 `@EncryptedJsonField`
- **自动加密解密**：基于TypeORM订阅器实现字段自动处理
- **复杂JSON路径支持**：支持嵌套对象、数组、根数组等复杂场景
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

  // 嵌套对象字段加密
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: [
      'name',
      'idCard',
      'contactInfo.email',
      'contactInfo.phone'
    ],
  })
  @Column({ type: 'jsonb', nullable: true })
  personalInfo: PersonalInfo;

  // 数组字段加密
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: [
      '[].street',
      '[].city',
      '[].contacts[].email',
      '[].contacts[].phone'
    ],
  })
  @Column({ type: 'jsonb', nullable: true })
  addresses: Address[];
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

支持多种路径格式：

```typescript
@EncryptedJsonField({
  autoEncrypt?: boolean,  // 是否自动加密（默认 true）
  paths: string[]         // 需要加密的JSON路径
})
```

**支持的路径格式：**

1. **普通对象路径**：
   ```typescript
   paths: ['name', 'contactInfo.email', 'contactInfo.phone']
   ```

2. **根数组路径**（字段本身就是数组）：
   ```typescript
   paths: ['[].street', '[].city', '[].contacts[].email']
   ```

3. **嵌套数组路径**（对象中的数组字段）：
   ```typescript
   paths: ['addresses[].street', 'addresses[].contacts[].email']
   ```

4. **混合场景**：
   ```typescript
   paths: [
     'name',
     'addresses[].street',
     'addresses[].contacts[].email'
   ]
   ```

### 使用示例

#### 嵌套对象加密

```typescript
@EncryptedJsonField({
  paths: ['name', 'idCard', 'contactInfo.email', 'contactInfo.phone'],
})
@Column({ type: 'jsonb' })
personalInfo: {
  name: string;
  idCard: string;
  contactInfo: {
    email: string;
    phone: string;
  };
};
```

#### 数组字段加密

```typescript
@EncryptedJsonField({
  paths: ['[].street', '[].city', '[].contacts[].email', '[].contacts[].phone'],
})
@Column({ type: 'jsonb' })
addresses: Array<{
  street: string;
  city: string;
  contacts: Array<{
    email: string;
    phone: string;
  }>;
}>;
```

#### 混合场景

```typescript
@EncryptedJsonField({
  paths: [
    'name',
    'addresses[].street',
    'addresses[].contacts[].email'
  ],
})
@Column({ type: 'jsonb' })
profile: {
  name: string;
  addresses: Array<{
    street: string;
    contacts: Array<{
      email: string;
    }>;
  }>;
};
```

## 特性

- ✅ **自动加密解密**：基于TypeORM生命周期自动处理
- ✅ **复杂路径支持**：支持任意深度的嵌套对象和数组
- ✅ **根数组支持**：支持字段本身就是数组的情况
- ✅ **混合场景**：支持对象中包含数组的复杂结构
- ✅ **错误处理**：解密失败时保持原值，不影响其他字段
- ✅ **类型安全**：完整的TypeScript类型支持
- ✅ **高性能**：基于AES-128-SHA256的高效加密算法

## 注意事项

1. **路径格式**：确保路径格式正确，支持 `[]` 表示数组遍历
2. **数据类型**：只对字符串类型的字段进行加密
3. **错误处理**：解密失败时会记录警告但继续处理其他字段
4. **性能考虑**：大量数据时建议分批处理

## 更新日志

### v1.0.0
- 🎉 初始版本发布
- ✨ 支持基础字段加密
- ✨ 支持JSON字段加密
- ✨ 支持复杂路径解析
- ✨ 支持根数组和嵌套数组
- ✨ 完整的错误处理机制

## 环境要求

- Node.js >= 18.0.0
- TypeScript >= 5.0.0（推荐）
- TypeORM >= 0.2.0（如需装饰器功能）

## 许可证

MIT License