# TypeORM Subscriber 结合装饰器使用指南

## 概述

在TypeORM项目中，我们可以结合装饰器（Decorators）来定义实体，并通过Subscriber来自动处理敏感数据的加密和解密。这种方式提供了类型安全和自动化的数据保护。

## 实体定义

### 1. 使用TypeORM装饰器定义实体

```typescript
import { 
  Entity, 
  PrimaryGeneratedColumn, 
  Column, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;        // 敏感字段

  @Column({ type: 'varchar', length: 20 })
  phone: string;           // 敏感字段

  @Column({ type: 'varchar', length: 255 })
  secretKey: string;       // 敏感字段

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2. 自定义装饰器标记敏感字段

```typescript
// 自定义装饰器标记敏感字段
function SensitiveField() {
  return function (target: any, propertyKey: string) {
    if (!target.constructor.sensitiveFields) {
      target.constructor.sensitiveFields = [];
    }
    target.constructor.sensitiveFields.push(propertyKey);
  };
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  password: string;

  @Column({ type: 'varchar', length: 20 })
  @SensitiveField()
  phone: string;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  secretKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## Subscriber 实现

### 1. 基础 Subscriber

```typescript
import { 
  EntitySubscriberInterface, 
  InsertEvent, 
  UpdateEvent, 
  LoadEvent 
} from 'typeorm';
import { ConfigManager, SensitiveData } from 'ankerutil-node';

export class SensitiveDataSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;

  constructor() {
    this.initializeSensitiveData();
  }

  private async initializeSensitiveData() {
    const configManager = new ConfigManager({
      nacos: {
        serverAddr: process.env.NACOS_SERVER || 'localhost:8848',
        namespace: process.env.NACOS_NAMESPACE || 'public',
        username: process.env.NACOS_USERNAME || 'nacos',
        password: process.env.NACOS_PASSWORD || 'nacos'
      },
      encryptedConfigDataId: 'ankerutil-encrypted-config',
      encryptedConfigGroup: 'DEFAULT_GROUP'
    });

    await configManager.initialize();
    this.sensitiveData = configManager.createSensitiveDataHandler();
  }

  // 监听用户实体
  listenTo() {
    return User;
  }

  // 插入前加密敏感数据
  beforeInsert(event: InsertEvent<User>) {
    this.encryptSensitiveFields(event.entity);
  }

  // 更新前加密敏感数据
  beforeUpdate(event: UpdateEvent<User>) {
    this.encryptSensitiveFields(event.entity);
  }

  // 查询后解密敏感数据
  afterLoad(entity: User) {
    this.decryptSensitiveFields(entity);
  }

  private encryptSensitiveFields(user: User) {
    if (!user) return;

    // 方法1: 硬编码敏感字段
    const sensitiveFields = ['password', 'phone', 'secretKey'];
    
    // 方法2: 使用自定义装饰器标记的字段
    // const sensitiveFields = (user.constructor as any).sensitiveFields || [];
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        user[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(user[field]);
      }
    }
  }

  private decryptSensitiveFields(user: User) {
    if (!user) return;

    const sensitiveFields = ['password', 'phone', 'secretKey'];
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        user[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(user[field]);
      }
    }
  }
}
```

### 2. 通用 Subscriber（支持多个实体）

```typescript
export class GenericSensitiveDataSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;
  private entityConfigs: Map<any, string[]> = new Map();

  constructor() {
    this.initializeSensitiveData();
    this.registerEntities();
  }

  private registerEntities() {
    // 注册需要处理的实体和其敏感字段
    this.entityConfigs.set(User, ['password', 'phone', 'secretKey']);
    this.entityConfigs.set(Employee, ['ssn', 'salary', 'bankAccount']);
    this.entityConfigs.set(Customer, ['creditCard', 'ssn']);
  }

  listenTo() {
    return Array.from(this.entityConfigs.keys());
  }

  beforeInsert(event: InsertEvent<any>) {
    const entityType = event.entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.encryptFields(event.entity, sensitiveFields);
    }
  }

  beforeUpdate(event: UpdateEvent<any>) {
    const entityType = event.entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.encryptFields(event.entity, sensitiveFields);
    }
  }

  afterLoad(entity: any) {
    const entityType = entity.constructor;
    const sensitiveFields = this.entityConfigs.get(entityType);
    if (sensitiveFields) {
      this.decryptFields(entity, sensitiveFields);
    }
  }

  private encryptFields(entity: any, fields: string[]) {
    for (const field of fields) {
      if (entity[field] && typeof entity[field] === 'string') {
        entity[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(entity[field]);
      }
    }
  }

  private decryptFields(entity: any, fields: string[]) {
    for (const field of fields) {
      if (entity[field] && typeof entity[field] === 'string') {
        entity[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(entity[field]);
      }
    }
  }
}
```

## 注册 Subscriber

### 1. 在 TypeORM 配置中注册

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensitiveDataSubscriber } from './subscribers/sensitive-data.subscriber';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'password',
      database: 'test',
      entities: [User, Employee, Customer],
      subscribers: [SensitiveDataSubscriber], // 注册 Subscriber
      synchronize: true,
    }),
  ],
})
export class AppModule {}
```

### 2. 在 DataSource 中注册

```typescript
// data-source.ts
import { DataSource } from 'typeorm';
import { SensitiveDataSubscriber } from './subscribers/sensitive-data.subscriber';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: 'localhost',
  port: 3306,
  username: 'root',
  password: 'password',
  database: 'test',
  entities: [User, Employee, Customer],
  subscribers: [SensitiveDataSubscriber], // 注册 Subscriber
  synchronize: true,
});
```

## 使用示例

### 1. 创建用户

```typescript
// user.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    
    // 注意：不需要手动加密，Subscriber 会自动处理
    return await this.userRepository.save(user);
  }

  async findUserById(id: number): Promise<User | null> {
    // 注意：不需要手动解密，Subscriber 会自动处理
    return await this.userRepository.findOne({ where: { id } });
  }
}
```

### 2. 控制器使用

```typescript
// user.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  async createUser(@Body() userData: Partial<User>) {
    // 密码会自动加密
    const user = await this.userService.createUser({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123', // 自动加密
      phone: '13800138000',  // 自动加密
      secretKey: 'api_key'   // 自动加密
    });
    
    return user;
  }

  @Get(':id')
  async getUser(@Param('id') id: number) {
    // 敏感字段会自动解密
    const user = await this.userService.findUserById(id);
    return user;
  }
}
```

## 高级用法

### 1. 条件加密

```typescript
export class ConditionalSensitiveDataSubscriber implements EntitySubscriberInterface {
  // ... 其他代码

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

### 2. 批量操作支持

```typescript
export class BatchSensitiveDataSubscriber implements EntitySubscriberInterface {
  // ... 其他代码

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

## 最佳实践

1. **类型安全**: 使用TypeScript接口定义实体类型
2. **装饰器标记**: 使用自定义装饰器标记敏感字段
3. **配置管理**: 将敏感字段配置集中管理
4. **错误处理**: 在Subscriber中添加适当的错误处理
5. **性能优化**: 避免在Subscriber中执行耗时操作
6. **测试覆盖**: 为Subscriber编写单元测试

## 注意事项

1. **初始化顺序**: 确保Subscriber在数据库连接建立前完成初始化
2. **内存管理**: 避免在Subscriber中存储大量数据
3. **事务处理**: 注意Subscriber在事务中的行为
4. **并发安全**: 确保Subscriber的线程安全
5. **日志记录**: 添加适当的日志记录以便调试 