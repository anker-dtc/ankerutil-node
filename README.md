# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密、TypeORM装饰器、哈希功能和增强版Nacos配置读取

## 版本 v1.7.0

✨ **新增增强版 Nacos 配置管理**
- 使用 HTTP 直连，无需官方 SDK 依赖
- 支持敏感配置 `{{xxx}}` 变量自动解密
- 提供完整的配置读取和 JSON 解析功能
- 简化配置，开箱即用

## 功能特性

- **AES-128 加密**：高性能敏感数据加密解密
- **TypeORM 装饰器**：`@EncryptedField`、`@EncryptedJsonField` 自动加密字段
- **哈希功能**：SHA256 哈希计算和验证
- **增强版 Nacos 配置**：HTTP 直连配置读取，支持敏感配置解密
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
# 无需额外依赖，开箱即用
```

### 基础加密

```typescript
import { Encryption, Hash } from 'ankerutil-node';

// AES 加密
const encryption = new Encryption();
encryption.init(cbcKey, rootKey);
const encrypted = encryption.encrypt("敏感数据");
const decrypted = encryption.decrypt(encrypted);

// SHA256 哈希
const hash = Hash.normalizeSha256("Hello World");
const isValid = Hash.verifyNormalized("Hello World", hash);
```

### TypeORM 集成

```typescript
import { EncryptedField, EncryptedJsonField, EncryptionSubscriber } from 'ankerutil-node';

@Entity()
export class User {
  @Column()
  @EncryptedField()
  password: string;

  @Column('json')
  @EncryptedJsonField(['credit_card', 'ssn'])
  sensitive_data: any;
}

// 配置 TypeORM
const connection = await createConnection({
  // ... 其他配置
  subscribers: [EncryptionSubscriber]
});
```

### 增强版 Nacos 配置

```typescript
import { EnhancedNacosConfig } from 'ankerutil-node';

// 创建客户端
const nacosClient = new EnhancedNacosConfig({
  serverAddr: '127.0.0.1:8848',
  namespace: 'production',
  username: 'nacos',
  password: 'nacos',
  
  // 敏感配置管理器（可选）
  secretManager: {
    Name: 'YourSystemName',
    Key: 'your-secret-key',
    Domain: 'https://your-secret-service.com'
  },
  
  // 启用敏感配置处理
  enableSecretProcessing: true,
  secretFailureStrategy: 'return_original'
});

// 初始化
await nacosClient.init();

// 获取配置（自动解密敏感字段）
const config = await nacosClient.getConfig('app.properties');
const jsonConfig = await nacosClient.getJsonConfig('database-config.json');

console.log('应用配置:', config);
console.log('数据库配置:', jsonConfig);
```

## 核心 API

### 1. 加密模块

#### Encryption 类
```typescript
const encryption = new Encryption();

// 初始化
encryption.init(cbcKey: string, rootKey: RootKey);

// 加密解密
encryption.encrypt(plaintext: string): string;
encryption.decrypt(ciphertext: string): string;
```

#### Hash 类
```typescript
// 哈希计算
Hash.normalizeSha256(input: string): string;
Hash.verifyNormalized(input: string, hash: string): boolean;
```

### 2. TypeORM 装饰器

#### @EncryptedField()
用于自动加密字符串字段：

```typescript
@Entity()
export class User {
  @Column()
  @EncryptedField()
  password: string;
}
```

#### @EncryptedJsonField(paths?)
用于加密 JSON 字段中的特定路径：

```typescript
@Entity()
export class Account {
  @Column('json')
  @EncryptedJsonField(['payment.card_number', 'personal.ssn'])
  data: any;
}
```

### 3. 增强版 Nacos 配置

#### EnhancedNacosConfig 类
```typescript
// 创建实例
const client = new EnhancedNacosConfig(options);

// 初始化
await client.init();

// 获取配置
const config = await client.getConfig(dataId, group?);
const jsonConfig = await client.getJsonConfig<T>(dataId, group?);

// 管理敏感配置
client.setSecretManager(config);
client.setSecretProcessingEnabled(enabled);
client.isSecretProcessingEnabled(): boolean;

// 测试连接
await client.testConnection();
```

#### 配置选项
```typescript
interface EnhancedNacosConfigOptions {
  // 基础配置
  serverAddr: string;           // Nacos 服务器地址
  namespace?: string;           // 命名空间
  username?: string;            // 用户名
  password?: string;            // 密码
  requestTimeout?: number;      // 请求超时时间
  
  // 敏感配置管理（可选）
  secretManager?: {
    Name: string;               // 系统名称
    Key: string;                // 密钥
    Domain: string;             // 服务域名
  };
  
  // 敏感配置选项
  enableSecretProcessing?: boolean;                    // 是否启用敏感配置处理
  secretFailureStrategy?: 'return_original' | 'throw_error';  // 失败策略
}
```

## 敏感配置处理

### 支持格式
系统会自动检测和处理包含 `{{xxx}}` 格式的敏感字段：

```json
{
  "database": {
    "host": "localhost",
    "password": "{{encrypted_db_password}}"
  },
  "api": {
    "key": "{{encrypted_api_key}}"
  }
}
```

### 工作流程
1. 检测配置中的 `{{xxx}}` 敏感字段标识符
2. 如果存在敏感字段，调用配置的 Secret Manager 服务进行解密
3. 返回解密后的配置内容
4. 如果解密失败，根据策略返回原始内容或抛出错误

## Express.js 集成示例

```typescript
import express from 'express';
import { EnhancedNacosConfig } from 'ankerutil-node';

const app = express();

// 初始化 Nacos 客户端
const nacosClient = new EnhancedNacosConfig({
  serverAddr: process.env.NACOS_SERVER || '127.0.0.1:8848',
  namespace: process.env.NACOS_NAMESPACE || 'production',
  username: process.env.NACOS_USERNAME || 'nacos',
  password: process.env.NACOS_PASSWORD || 'nacos',
  secretManager: {
    Name: process.env.SECRET_SYSTEM_NAME!,
    Key: process.env.SECRET_KEY!,
    Domain: process.env.SECRET_DOMAIN!
  }
});

await nacosClient.init();

// 中间件：注入配置
app.use(async (req, res, next) => {
  try {
    req.config = {
      app: await nacosClient.getJsonConfig('app-config'),
      database: await nacosClient.getJsonConfig('database-config')
    };
    next();
  } catch (error) {
    res.status(500).json({ error: 'Configuration loading failed' });
  }
});

app.listen(3000);
```

## NestJS 集成示例

```typescript
import { Injectable, Module } from '@nestjs/common';
import { EnhancedNacosConfig } from 'ankerutil-node';

@Injectable()
export class ConfigService {
  private nacosClient: EnhancedNacosConfig;

  constructor() {
    this.nacosClient = new EnhancedNacosConfig({
      serverAddr: process.env.NACOS_SERVER || '127.0.0.1:8848',
      namespace: process.env.NACOS_NAMESPACE || 'production',
      username: process.env.NACOS_USERNAME || 'nacos',
      password: process.env.NACOS_PASSWORD || 'nacos',
      secretManager: {
        Name: process.env.SECRET_SYSTEM_NAME!,
        Key: process.env.SECRET_KEY!,
        Domain: process.env.SECRET_DOMAIN!
      }
    });
  }

  async onModuleInit() {
    await this.nacosClient.init();
  }

  async getAppConfig() {
    return this.nacosClient.getJsonConfig('app-config');
  }

  async getDatabaseConfig() {
    return this.nacosClient.getJsonConfig('database-config');
  }
}

@Module({
  providers: [ConfigService],
  exports: [ConfigService]
})
export class ConfigModule {}
```

## 错误处理

### 配置策略
```typescript
const client = new EnhancedNacosConfig({
  // ... 其他配置
  secretFailureStrategy: 'return_original'  // 或 'throw_error'
});

// 动态切换策略
client.setSecretFailureStrategy('throw_error');
```

### 异常类型
- `HttpNacosConfigError`: HTTP 请求相关错误
- `SecretManageError`: 敏感配置处理错误

### 处理示例
```typescript
try {
  const config = await client.getJsonConfig('app-config');
} catch (error) {
  if (error instanceof HttpNacosConfigError) {
    console.error('Nacos 连接错误:', error.message);
  } else if (error instanceof SecretManageError) {
    console.error('敏感配置处理错误:', error.message);
  }
}
```

## 注意事项

1. **密钥安全**：请妥善保管加密密钥，建议使用环境变量
2. **网络连接**：确保应用能够访问 Nacos 服务器和 Secret Manager 服务
3. **错误策略**：根据业务需求选择合适的错误处理策略
4. **性能考虑**：敏感配置解密会增加一定的网络延迟

## 版本兼容性

- Node.js: >= 18.0.0
- TypeScript: >= 4.0.0 (可选)
- TypeORM: >= 0.2.0 (使用 TypeORM 功能时)

## 更新日志

### v1.7.0
- 新增增强版 Nacos 配置管理功能
- 移除对官方 nacos SDK 的依赖
- 使用 HTTP 直连方式，提高兼容性
- 支持敏感配置自动解密
- 优化错误处理和日志输出

### v1.6.x
- 完善 TypeORM 装饰器功能
- 增加哈希验证功能
- 性能优化

## 许可证

MIT License