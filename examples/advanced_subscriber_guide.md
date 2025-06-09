# 高级Subscriber使用指南

## 概述

高级Subscriber是SDK中提供的一个强大的功能，它可以将你宿主项目中的复杂加密逻辑迁移到SDK中，实现统一的敏感数据处理。

## 主要特性

### 1. 普通字段加密
- 支持简单的字符串字段自动加密/解密
- 可配置是否自动加密
- 解密失败时保持原值，记录警告日志

### 2. JSON路径加密
- 支持复杂的JSON结构中的特定路径加密
- 支持数组元素的加密，如 `items[0].name`
- 支持嵌套对象的加密，如 `metadata.secret`
- 支持根数组路径，如 `[].name`

### 3. 错误处理
- 解密失败时保持原值，不会丢失数据
- 详细的错误日志记录
- 区分加密错误和解密错误

### 4. 装饰器支持
- 通过装饰器自动标记需要加密的字段
- 支持普通字段和JSON字段装饰器
- 灵活的配置选项

## 使用方法

### 1. 定义实体

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { createEncryptedFieldDecorator, createEncryptedJsonFieldDecorator } from 'ankerutil-node';

// 创建装饰器
const EncryptedField = createEncryptedFieldDecorator({ autoEncrypt: true });
const EncryptedJsonField = createEncryptedJsonFieldDecorator({
  autoEncrypt: true,
  paths: ['items[0].name', 'items[1].name', 'metadata.secret']
});

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  @EncryptedField({ autoEncrypt: true })
  password: string;

  @Column({ type: 'varchar', length: 20 })
  @EncryptedField({ autoEncrypt: true })
  phone: string;

  @Column({ type: 'json' })
  @EncryptedJsonField({
    autoEncrypt: true,
    paths: ['items[0].name', 'items[1].name', 'metadata.secret']
  })
  profile: any;
}
```

### 2. 配置集成

```typescript
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
```

### 3. 使用示例

```typescript
// 保存用户（自动加密）
const user = await userRepository.save({
  name: 'John',
  password: 'secret123',           // 自动加密
  phone: '13800138000',            // 自动加密
  profile: {                       // JSON字段自动加密
    items: [
      { name: 'item1_secret' },    // 自动加密
      { name: 'item2_secret' }     // 自动加密
    ],
    metadata: {
      secret: 'metadata_secret'    // 自动加密
    }
  }
});

// 查询用户（自动解密）
const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password);   // 自动解密: 'secret123'
console.log(savedUser.profile.items[0].name); // 自动解密: 'item1_secret'
```

## JSON路径语法

### 基本语法
- `field` - 普通字段
- `field.subfield` - 嵌套字段
- `field[0]` - 数组元素
- `field[0].subfield` - 数组元素的子字段

### 示例路径
```typescript
const paths = [
  'name',                    // 根字段
  'profile.name',            // 嵌套字段
  'items[0].name',           // 数组元素字段
  'items[1].metadata.secret', // 深层嵌套
  '[].name',                 // 根数组路径
  '[].metadata.secret'       // 根数组的嵌套字段
];
```

## 错误处理

### 解密失败处理
当解密失败时（可能是明文数据），系统会：
1. 保持原值不变
2. 记录警告日志
3. 继续处理其他字段

```typescript
// 日志示例
// 解密失败，可能是明文数据，字段: password, 错误: Invalid encrypted data
// 解密失败，可能是明文数据，路径: 'profile.items[0].name', 错误: Invalid encrypted data
```

### 加密失败处理
当加密失败时，系统会：
1. 抛出 `EncryptionError` 异常
2. 包含详细的错误信息
3. 阻止数据保存

## 配置选项

### EncryptedFieldOptions
```typescript
interface EncryptedFieldOptions {
  autoEncrypt?: boolean;  // 是否自动加密，默认true
  [key: string]: any;     // 其他自定义选项
}
```

### EncryptedJsonFieldOptions
```typescript
interface EncryptedJsonFieldOptions {
  autoEncrypt?: boolean;  // 是否自动加密，默认true
  paths: string[];        // 需要加密的JSON路径数组
  [key: string]: any;     // 其他自定义选项
}
```

## 最佳实践

### 1. 合理使用JSON路径
```typescript
// 好的做法：只加密敏感字段
@EncryptedJsonField({
  paths: ['password', 'token', 'secret']
})

// 避免：加密整个对象
@EncryptedJsonField({
  paths: ['*']  // 不推荐
})
```

### 2. 错误日志监控
```typescript
// 设置合适的日志级别
const logger = {
  warn: (message) => {
    // 监控解密失败的情况
    if (message.includes('解密失败')) {
      // 发送告警或记录到监控系统
    }
    console.warn(message);
  }
};
```

### 3. 数据迁移
```typescript
// 处理历史数据时，解密失败是正常的
// 系统会自动保持原值，无需手动处理
const users = await userRepository.find();
// 第一次查询时，明文数据会保持原样
// 后续保存时会自动加密
```

## 性能考虑

### 1. JSON路径解析
- 路径解析是同步的，性能影响很小
- 复杂的JSON结构会增加处理时间
- 建议只加密必要的字段

### 2. 批量操作
- 支持批量插入和更新
- 每个实体都会触发Subscriber事件
- 大量数据时注意内存使用

### 3. 缓存策略
- 加密服务本身有缓存机制
- 避免重复的路径解析
- 考虑使用连接池

## 故障排除

### 1. 装饰器不生效
```typescript
// 确保正确导入和使用装饰器
import { createEncryptedFieldDecorator } from 'ankerutil-node';

const EncryptedField = createEncryptedFieldDecorator({ autoEncrypt: true });

@Entity('users')
export class User {
  @EncryptedField
  password: string;
}
```

### 2. JSON路径错误
```typescript
// 检查路径语法
const paths = [
  'items[0].name',     // 正确
  'items[0]name',      // 错误：缺少点号
  'items[].name',      // 错误：缺少索引
];
```

### 3. 解密失败
```typescript
// 检查加密服务配置
const integration = new TypeORMIntegrationBuilder()
  .setEncryptedConfig('ankerutil-keys')  // 确保配置ID正确
  .setUseAdvancedSubscriber(true)
  .build();
```

## 总结

高级Subscriber提供了一个强大而灵活的解决方案，可以将复杂的加密逻辑从宿主项目中迁移到SDK中。它支持：

- 普通字段和JSON字段的加密
- 复杂的JSON路径语法
- 完善的错误处理机制
- 装饰器驱动的配置
- 与TypeORM的无缝集成

通过合理使用这些功能，可以大大简化敏感数据的处理逻辑，提高代码的可维护性和安全性。 