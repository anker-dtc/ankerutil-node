# TypeORM集成封装指南

## 概述

通过`ankerutil-node`工具包，你可以将TypeORM相关的所有逻辑（包括连接管理、Subscriber注册、敏感数据处理等）完全封装，让宿主项目更加简洁和易维护。

## 封装的优势

### 1. **简化宿主项目配置**
- 无需在宿主项目中手动配置TypeORM连接
- 无需手动创建和注册Subscriber
- 无需管理敏感数据处理的复杂逻辑

### 2. **统一管理**
- 所有TypeORM相关配置集中在一个地方
- 敏感字段配置统一管理
- 自动化的生命周期处理

### 3. **向后兼容**
- 不影响现有的`sensitiveData`方法使用
- 可以逐步迁移到新的集成方式
- 支持混合使用模式

## 使用方式

### 1. **基础配置**

```typescript
import { TypeORMIntegrationBuilder } from 'ankerutil-node';
import { DataSource } from 'typeorm';
import { User, Employee } from './entities';

// 使用构建器模式配置
const integration = new TypeORMIntegrationBuilder()
  .setDatabase({
    type: 'mysql',
    host: 'localhost',
    port: 3306,
    username: 'root',
    password: 'password',
    database: 'test',
    synchronize: true
  })
  .setNacos({
    serverAddr: 'localhost:8848',
    namespace: 'public',
    username: 'nacos',
    password: 'nacos'
  })
  .setEncryptedConfig('ankerutil-encrypted-config', 'DEFAULT_GROUP')
  .setEntities([User, Employee])
  .setSensitiveFields(new Map([
    [User, ['password', 'phone', 'secretKey']],
    [Employee, ['ssn', 'salary', 'bankAccount']]
  ]))
  .setAutoRegisterSensitiveSubscriber(true)
  .build();
```

### 2. **设置DataSource工厂**

```typescript
// 设置DataSource工厂函数（宿主项目提供TypeORM）
integration.setDataSourceFactory((options) => new DataSource(options));
```

### 3. **初始化集成**

```typescript
// 初始化（自动处理所有配置）
await integration.initialize();
```

### 4. **使用集成**

```typescript
// 获取DataSource
const dataSource = integration.getDataSource();

// 获取敏感数据处理器（如果需要单独使用）
const sensitiveData = integration.getSensitiveData();

// 使用Repository（自动加密/解密）
const userRepository = dataSource.getRepository(User);

// 保存用户（自动加密敏感字段）
const user = await userRepository.save({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123', // 自动加密
  phone: '13800138000',  // 自动加密
  secretKey: 'api_key'   // 自动加密
});

// 查询用户（自动解密敏感字段）
const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password); // 自动解密: 'secret123'
```

## 在不同框架中的使用

### NestJS

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeORMIntegrationBuilder } from 'ankerutil-node';
import { DataSource } from 'typeorm';

@Module({
  providers: [
    {
      provide: 'TYPEORM_INTEGRATION',
      useFactory: async () => {
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
          .setEntities([User, Employee])
          .setSensitiveFields(new Map([
            [User, ['password', 'phone']],
            [Employee, ['ssn', 'salary']]
          ]))
          .build();

        integration.setDataSourceFactory((options) => new DataSource(options));
        await integration.initialize();
        
        return integration;
      }
    }
  ],
  exports: ['TYPEORM_INTEGRATION']
})
export class AppModule {}
```

### Express.js

```typescript
// app.ts
import express from 'express';
import { TypeORMIntegrationBuilder } from 'ankerutil-node';
import { DataSource } from 'typeorm';

const app = express();

// 初始化TypeORM集成
async function initializeTypeORM() {
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
    .setEntities([User, Employee])
    .setSensitiveFields(new Map([
      [User, ['password', 'phone']],
      [Employee, ['ssn', 'salary']]
    ]))
    .build();

  integration.setDataSourceFactory((options) => new DataSource(options));
  await integration.initialize();
  
  return integration;
}

// 启动应用
async function startApp() {
  const integration = await initializeTypeORM();
  const dataSource = integration.getDataSource();
  
  // 将dataSource挂载到app上
  app.locals.dataSource = dataSource;
  
  app.listen(3000, () => {
    console.log('Server running on port 3000');
  });
}

startApp();
```

### Fastify

```typescript
// app.ts
import fastify from 'fastify';
import { TypeORMIntegrationBuilder } from 'ankerutil-node';
import { DataSource } from 'typeorm';

const app = fastify();

// 初始化TypeORM集成
async function initializeTypeORM() {
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
    .setEntities([User, Employee])
    .setSensitiveFields(new Map([
      [User, ['password', 'phone']],
      [Employee, ['ssn', 'salary']]
    ]))
    .build();

  integration.setDataSourceFactory((options) => new DataSource(options));
  await integration.initialize();
  
  return integration;
}

// 注册装饰器
app.decorate('dataSource', null);

// 启动应用
async function startApp() {
  const integration = await initializeTypeORM();
  const dataSource = integration.getDataSource();
  
  // 将dataSource挂载到fastify实例上
  app.dataSource = dataSource;
  
  await app.listen({ port: 3000 });
  console.log('Server running on port 3000');
}

startApp();
```

## 高级配置

### 1. **自定义装饰器**

```typescript
import { createSensitiveFieldDecorator } from 'ankerutil-node';

// 创建敏感字段装饰器
const SensitiveField = createSensitiveFieldDecorator();

// 在实体中使用
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  password: string;

  @Column({ type: 'varchar', length: 20 })
  @SensitiveField()
  phone: string;
}
```

### 2. **条件加密**

```typescript
// 在Subscriber中实现条件加密逻辑
class ConditionalSensitiveDataSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<User>) {
    const user = event.entity;
    
    // 只加密非空字段
    if (user.password) {
      user.password = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.password);
    }
    
    // 根据用户角色决定是否加密某些字段
    if (user.role === 'admin' && user.secretKey) {
      user.secretKey = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.secretKey);
    }
  }
}
```

### 3. **批量操作支持**

```typescript
// 支持批量实体的自动处理
class BatchSensitiveDataSubscriber implements EntitySubscriberInterface {
  afterLoad(entity: any) {
    // 支持数组实体的批量解密
    if (Array.isArray(entity)) {
      entity.forEach(item => this.decryptSensitiveFields(item));
    } else {
      this.decryptSensitiveFields(entity);
    }
  }
}
```

## 迁移指南

### 从现有项目迁移

1. **保持现有功能不变**
   ```typescript
   // 现有的sensitiveData使用方式继续有效
   const configManager = new ConfigManager({...});
   await configManager.initialize();
   const sensitiveData = configManager.createSensitiveDataHandler();
   
   sensitiveData.aes128Sha256EncryptSensitiveData('plaintext');
   ```

2. **逐步添加TypeORM集成**
   ```typescript
   // 新增TypeORM集成，不影响现有代码
   const integration = new TypeORMIntegrationBuilder()
     .setDatabase({...})
     .setNacos({...})
     .setEncryptedConfig('ankerutil-keys')
     .setEntities([User, Employee])
     .setSensitiveFields(new Map([...]))
     .build();
   ```

3. **混合使用模式**
   ```typescript
   // 可以同时使用两种方式
   const integration = await initializeTypeORM();
   const dataSource = integration.getDataSource();
   const sensitiveData = integration.getSensitiveData();
   
   // 使用TypeORM自动处理
   const user = await userRepository.save({...});
   
   // 使用手动处理
   const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData('manual');
   ```

## 最佳实践

1. **配置集中管理**: 将所有TypeORM相关配置集中在一个配置文件中
2. **环境变量**: 使用环境变量管理敏感配置信息
3. **错误处理**: 在集成初始化时添加适当的错误处理
4. **日志记录**: 添加详细的日志记录以便调试
5. **测试覆盖**: 为集成功能编写完整的测试用例

## 总结

通过`ankerutil-node`的TypeORM集成封装，你可以：

- ✅ **简化宿主项目**: 无需手动管理TypeORM连接和Subscriber
- ✅ **自动处理敏感数据**: 自动加密/解密，无需手动调用
- ✅ **保持向后兼容**: 不影响现有的`sensitiveData`使用方式
- ✅ **支持多种框架**: NestJS、Express.js、Fastify等
- ✅ **类型安全**: 完整的TypeScript类型支持
- ✅ **灵活配置**: 支持多种配置方式和自定义扩展

这种封装方式让宿主项目更加简洁，同时提供了强大的功能和良好的扩展性。 