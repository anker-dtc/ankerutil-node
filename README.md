# AnkerUtil-Node

Node.js 敏感数据加密工具库，专为 TypeORM 项目设计，提供 AES-128-CBC + SHA256 混合加密方案，支持多版本根密钥管理，集成 Nacos 配置中心。

## 应用场景

本SDK主要应用于 **TypeORM Subscriber** 中，用于：
- 数据库实体保存前的敏感数据自动加密
- 数据库实体查询后的敏感数据自动解密
- 海量数据导出时的批量解密处理
- 数据迁移时的批量加密/解密操作

## 功能特性

- 混合加密方案：AES-128-CBC 数据加密 + SHA256 摘要验证
- 多版本根密钥支持：支持密钥版本管理和轮换
- 跨语言兼容：与 Go/Ruby 版本保持算法兼容性
- **TypeORM 集成**：专为 TypeORM Subscriber 场景优化
- **Nacos 配置集成**：自动从 Nacos 加载加密配置，支持配置热更新
- **敏感数据自动处理**：自动识别和加密/解密配置中的敏感字段
- **高性能批量处理**：支持海量数据的批量加密/解密操作
- **架构分离设计**：Nacos配置加载与加密/解密逻辑完全分离
- 自动处理特殊字符和编码问题
- 完善的边界条件处理（空值/非法格式/超长数据）

## 安装

```bash
npm install ankerutil-node
```

## 架构设计

### 🏗️ **TypeORM Subscriber 应用架构**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ConfigManager │    │ SensitiveData   │    │ TypeORM         │
│                 │    │                 │    │ Subscriber      │
│ • 应用启动时    │───▶│ • 独立的加密    │◀───│ • BeforeInsert  │
│   从Nacos加载   │    │   解密处理器    │    │ • BeforeUpdate  │
│   加密配置      │    │ • 无网络请求    │    │ • AfterLoad     │
│ • 创建处理器    │    │ • 高性能操作    │    │ • 批量处理      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 📊 **核心设计原则**

1. **配置与逻辑分离**：Nacos配置加载只在应用启动时执行一次
2. **独立处理器**：每个Subscriber创建独立的敏感数据处理器
3. **高性能批量处理**：支持海量数据的批量解密操作

## 主要功能

### 1. TypeORM Subscriber 集成

#### 基本使用
```typescript
import { EntitySubscriberInterface, InsertEvent, UpdateEvent, LoadEvent } from 'typeorm';
import { ConfigManager, SensitiveData } from 'ankerutil-node';

export class UserSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;

  constructor() {
    // 应用启动时初始化配置管理器
    this.initializeSensitiveData();
  }

  private async initializeSensitiveData() {
    const configManager = new ConfigManager({
      nacos: {
        serverAddr: process.env.NACOS_SERVER || 'localhost:8848',
        namespace: process.env.NACOS_NAMESPACE || 'public',
        username: process.env.NACOS_USERNAME,
        password: process.env.NACOS_PASSWORD
      },
      encryptedConfigDataId: 'ankerutil-encrypted-config',
      encryptedConfigGroup: 'DEFAULT_GROUP'
    });

    await configManager.initialize();
    this.sensitiveData = configManager.createSensitiveDataHandler();
  }

  // 保存前自动加密敏感数据
  beforeInsert(event: InsertEvent<User>) {
    const user = event.entity;
    if (user.password) {
      user.password = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.password);
    }
    if (user.phone) {
      user.phone = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.phone);
    }
  }

  beforeUpdate(event: UpdateEvent<User>) {
    const user = event.entity;
    if (user.password) {
      user.password = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.password);
    }
    if (user.phone) {
      user.phone = this.sensitiveData.aes128Sha256EncryptSensitiveData(user.phone);
    }
  }

  // 查询后自动解密敏感数据
  afterLoad(entity: User) {
    if (entity.password) {
      entity.password = this.sensitiveData.aes128Sha256DecryptSensitiveData(entity.password);
    }
    if (entity.phone) {
      entity.phone = this.sensitiveData.aes128Sha256DecryptSensitiveData(entity.phone);
    }
  }
}
```

#### 注册 Subscriber
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserSubscriber } from './subscribers/user.subscriber';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      // ... 数据库配置
      subscribers: [UserSubscriber],
    }),
  ],
})
export class AppModule {}
```

### 2. 海量数据批量处理

#### 数据导出场景
```typescript
import { ConfigManager, BatchProcessor } from 'ankerutil-node';

export class DataExportService {
  private batchProcessor: BatchProcessor;

  constructor() {
    this.initializeBatchProcessor();
  }

  private async initializeBatchProcessor() {
    const configManager = new ConfigManager({
      nacos: { /* nacos配置 */ },
      encryptedConfigDataId: 'ankerutil-keys',
      encryptedConfigGroup: 'DEFAULT_GROUP'
    });

    await configManager.initialize();
    const sensitiveData = configManager.createSensitiveDataHandler();
    
    this.batchProcessor = new BatchProcessor(sensitiveData, {
      batchSize: 1000,
      concurrency: 4,
      onProgress: (processed, total) => {
        console.log(`导出进度: ${processed}/${total}`);
      }
    });
  }

  // 批量导出用户数据（自动解密敏感字段）
  async exportUsers(): Promise<User[]> {
    // 从数据库获取加密的用户数据
    const encryptedUsers = await this.userRepository.find();
    
    // 批量解密敏感字段
    const decryptedUsers = await this.batchProcessor.batchDecryptObjects(
      encryptedUsers, 
      ['password', 'phone', 'email']
    );
    
    return decryptedUsers;
  }

  // 流式导出超大数据集
  async * streamExportUsers() {
    const query = this.userRepository.createQueryBuilder('user');
    
    // 分批查询，避免内存溢出
    let offset = 0;
    const limit = 10000;
    
    while (true) {
      const batch = await query
        .skip(offset)
        .take(limit)
        .getMany();
      
      if (batch.length === 0) break;
      
      // 批量解密
      const decryptedBatch = await this.batchProcessor.batchDecryptObjects(
        batch, 
        ['password', 'phone']
      );
      
      yield decryptedBatch;
      offset += limit;
    }
  }
}
```

#### 数据迁移场景
```typescript
export class DataMigrationService {
  private batchProcessor: BatchProcessor;

  // 初始化同上...

  // 批量加密现有数据
  async migrateExistingData() {
    const users = await this.userRepository.find({
      where: { isEncrypted: false }
    });

    // 批量加密敏感字段
    const encryptedUsers = await this.batchProcessor.batchEncryptObjects(
      users, 
      ['password', 'phone']
    );

    // 批量更新数据库
    for (const user of encryptedUsers) {
      user.isEncrypted = true;
      await this.userRepository.save(user);
    }
  }
}
```

### 3. 敏感数据自动识别

配置管理器会自动识别并处理以下字段名中的敏感数据：
- `password`, `secret`, `key`, `token`, `credential`
- `auth`, `private`, `sensitive`, `encrypted`

```typescript
// 这些字段会自动加密/解密
@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  password: string;        // 自动加密/解密

  @Column()
  phone: string;           // 自动加密/解密

  @Column()
  email: string;           // 不加密
}
```

## 使用示例

### TypeORM 项目集成
```typescript
// 1. 创建 Subscriber
export class SensitiveDataSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;

  async initialize() {
    const configManager = new ConfigManager({
      nacos: {
        serverAddr: process.env.NACOS_SERVER,
        namespace: process.env.NACOS_NAMESPACE,
        username: process.env.NACOS_USERNAME,
        password: process.env.NACOS_PASSWORD
      },
      encryptedConfigDataId: 'ankerutil-keys',
      encryptedConfigGroup: 'DEFAULT_GROUP'
    });

    await configManager.initialize();
    this.sensitiveData = configManager.createSensitiveDataHandler();
  }

  beforeInsert(event: InsertEvent<any>) {
    this.encryptSensitiveFields(event.entity);
  }

  beforeUpdate(event: UpdateEvent<any>) {
    this.encryptSensitiveFields(event.entity);
  }

  afterLoad(entity: any) {
    this.decryptSensitiveFields(entity);
  }

  private encryptSensitiveFields(entity: any) {
    if (!entity) return;
    
    const sensitiveFields = ['password', 'phone', 'secretKey'];
    for (const field of sensitiveFields) {
      if (entity[field]) {
        entity[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(entity[field]);
      }
    }
  }

  private decryptSensitiveFields(entity: any) {
    if (!entity) return;
    
    const sensitiveFields = ['password', 'phone', 'secretKey'];
    for (const field of sensitiveFields) {
      if (entity[field]) {
        entity[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(entity[field]);
      }
    }
  }
}

// 2. 注册到 TypeORM
const dataSource = new DataSource({
  // ... 其他配置
  subscribers: [SensitiveDataSubscriber],
});

// 3. 使用
const user = new User();
user.name = 'John Doe';
user.password = 'secret123';  // 自动加密
user.phone = '13800138000';   // 自动加密

await userRepository.save(user);  // 保存时自动加密

const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password);  // 自动解密: 'secret123'
```

### 批量数据处理
```typescript
// 数据导出服务
export class ExportService {
  private batchProcessor: BatchProcessor;

  async exportAllUsers(): Promise<User[]> {
    const users = await this.userRepository.find();
    
    // 批量解密敏感字段
    return await this.batchProcessor.batchDecryptObjects(users, [
      'password', 'phone', 'email'
    ]);
  }

  // 流式导出，避免内存溢出
  async * streamExportUsers() {
    const query = this.userRepository.createQueryBuilder('user');
    let offset = 0;
    const limit = 5000;

    while (true) {
      const batch = await query.skip(offset).take(limit).getMany();
      if (batch.length === 0) break;

      const decryptedBatch = await this.batchProcessor.batchDecryptObjects(
        batch, 
        ['password', 'phone']
      );

      yield decryptedBatch;
      offset += limit;
    }
  }
}
```

## 性能特性

- **零网络开销**：加密/解密操作不涉及网络请求
- **自动触发**：TypeORM 生命周期自动处理敏感数据
- **并发处理**：批量操作支持多线程并发
- **内存优化**：流式处理支持超大数据集
- **进度监控**：批量操作实时进度回调

## 测试
```bash
npm test
```

## 许可证
MIT