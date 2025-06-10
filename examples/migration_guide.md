# 从宿主项目迁移到SDK指南

## 概述

本指南将帮助你将宿主项目中的复杂加密Subscriber逻辑迁移到SDK中，实现统一的敏感数据处理。

## 迁移优势

### 1. 代码复用
- 将复杂的加密逻辑从宿主项目中提取出来
- 多个项目可以共享相同的加密处理逻辑
- 减少重复代码，提高维护效率

### 2. 统一管理
- 所有加密相关的逻辑都在SDK中统一管理
- 配置、错误处理、日志记录等都在一个地方
- 便于版本控制和功能升级

### 3. 更好的封装
- 隐藏复杂的实现细节
- 提供简洁的API接口
- 降低使用门槛

## 迁移步骤

### 步骤1：分析现有代码

首先分析你现有的`EncryptionSubscriber`代码：

```typescript
// 你的现有代码
export class EncryptionSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(EncryptionSubscriber.name);
  private static encryptionService: EncryptionService;

  constructor(private readonly encryptionService?: EncryptionService) {
    if (encryptionService) {
      EncryptionSubscriber.encryptionService = encryptionService;
    }
  }

  // ... 其他方法
}
```

### 步骤2：识别功能特性

从你的代码中，我们识别出以下特性：

1. **普通字段加密/解密**
   - `encryptField` / `decryptField` 方法
   - 支持 `autoEncrypt` 选项
   - 解密失败时保持原值

2. **JSON路径加密/解密**
   - `encryptJsonField` / `decryptJsonField` 方法
   - 支持复杂的JSON路径，如 `items[0].name`
   - 支持根数组路径，如 `[].name`

3. **错误处理**
   - 解密失败时记录警告但继续处理
   - 加密失败时抛出异常
   - 详细的错误信息

4. **装饰器支持**
   - 通过装饰器标记需要加密的字段
   - 支持普通字段和JSON字段装饰器

### 步骤3：使用SDK功能

#### 3.1 替换Subscriber

```typescript
// 原来的代码
import { EncryptionSubscriber } from './your-project/encryption-subscriber';

// 迁移后的代码
import { AdvancedEncryptionSubscriber } from 'ankerutil-node';
```

#### 3.2 更新实体定义

```typescript
// 原来的代码
@Entity('users')
export class User {
  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'json' })
  profile: any;
}

// 迁移后的代码
import { createEncryptedFieldDecorator, createEncryptedJsonFieldDecorator } from 'ankerutil-node';

const EncryptedField = createEncryptedFieldDecorator({ autoEncrypt: true });
const EncryptedJsonField = createEncryptedJsonFieldDecorator({
  autoEncrypt: true,
  paths: ['items[0].name', 'items[1].name', 'metadata.secret']
});

@Entity('users')
export class User {
  @Column({ type: 'varchar', length: 255 })
  @EncryptedField({ autoEncrypt: true })
  password: string;

  @Column({ type: 'json' })
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: ['items[0].name', 'items[1].name', 'metadata.secret']
  })
  profile: any;
}
```

#### 3.3 更新配置

```typescript
// 原来的代码
const dataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'test',
  entities: [User],
  subscribers: [new EncryptionSubscriber(encryptionService)]
});

// 迁移后的代码
import { TypeORMIntegrationBuilder } from 'ankerutil-node';

const integration = new TypeORMIntegrationBuilder()
  .setDatabase({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'password',
    database: 'test'
  })
  .setNacos({
    serverAddr: 'localhost:8848',
    namespace: 'public'
  })
  .setEncryptedConfig('ankerutil-keys')
  .setEntities([User])
  .setUseAdvancedSubscriber(true)  // 启用高级Subscriber
  .setLogger(logger)               // 设置日志器
  .build();

await integration.initialize();
const dataSource = integration.getDataSource();
```

### 步骤4：处理依赖关系

#### 4.1 移除原有依赖

```bash
# 移除原有的加密相关依赖
npm uninstall your-encryption-package
```

#### 4.2 添加SDK依赖

```bash
# 添加SDK依赖
npm install ankerutil-node
```

### 步骤5：测试验证

#### 5.1 功能测试

```typescript
// 测试普通字段加密
const user = await userRepository.save({
  name: 'John',
  password: 'secret123',  // 应该自动加密
  phone: '13800138000'    // 应该自动加密
});

// 测试JSON字段加密
const userWithProfile = await userRepository.save({
  name: 'John',
  profile: {
    items: [
      { name: 'item1_secret' },  // 应该自动加密
      { name: 'item2_secret' }   // 应该自动加密
    ],
    metadata: {
      secret: 'metadata_secret'  // 应该自动加密
    }
  }
});

// 测试解密
const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password);  // 应该自动解密
console.log(savedUser.profile.items[0].name);  // 应该自动解密
```

#### 5.2 错误处理测试

```typescript
// 测试解密失败的情况（明文数据）
const userWithPlainText = await userRepository.save({
  name: 'John',
  password: 'plain_text_password'  // 明文密码
});

// 查询时应该保持原值，记录警告日志
const user = await userRepository.findOne({ where: { id: 1 } });
console.log(user.password);  // 应该保持 'plain_text_password'
```

## 功能对比

| 功能 | 原代码 | SDK实现 | 状态 |
|------|--------|---------|------|
| 普通字段加密 | ✅ | ✅ | 完全兼容 |
| JSON路径加密 | ✅ | ✅ | 完全兼容 |
| 数组支持 | ✅ | ✅ | 完全兼容 |
| 错误处理 | ✅ | ✅ | 完全兼容 |
| 装饰器支持 | ✅ | ✅ | 完全兼容 |
| 日志记录 | ✅ | ✅ | 完全兼容 |
| 配置管理 | ❌ | ✅ | 增强功能 |
| 批量处理 | ❌ | ✅ | 新增功能 |
| 缓存机制 | ❌ | ✅ | 新增功能 |

## 注意事项

### 1. 数据兼容性
- SDK完全兼容你原有的数据格式
- 解密失败时会保持原值，不会丢失数据
- 支持明文和密文混合的数据

### 2. 性能影响
- SDK使用了更高效的加密算法
- 内置缓存机制，减少重复计算
- 批量操作性能更好

### 3. 配置迁移
- 需要将原有的加密配置迁移到Nacos
- 配置格式略有不同，但功能完全一致
- 支持更灵活的配置选项

### 4. 错误处理
- 错误处理逻辑完全一致
- 日志格式保持一致
- 支持自定义日志器

## 迁移检查清单

- [ ] 分析现有代码结构
- [ ] 识别所有加密字段和JSON路径
- [ ] 更新实体定义，添加装饰器
- [ ] 配置SDK集成
- [ ] 移除原有依赖
- [ ] 添加SDK依赖
- [ ] 运行功能测试
- [ ] 验证错误处理
- [ ] 检查日志输出
- [ ] 性能测试
- [ ] 文档更新

## 总结

通过将你的`EncryptionSubscriber`逻辑迁移到SDK中，你可以：

1. **减少代码重复** - 多个项目共享相同的加密逻辑
2. **提高维护效率** - 统一的代码库，便于维护和升级
3. **增强功能** - 获得更多高级功能，如批量处理、缓存等
4. **简化配置** - 通过Nacos统一管理配置
5. **提高安全性** - 使用更安全的加密算法和最佳实践

迁移过程是平滑的，不会影响现有功能，同时为你提供更多强大的功能。 