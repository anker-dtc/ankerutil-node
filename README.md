# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密、TypeORM装饰器、哈希功能和Nacos配置读取

## 版本 v1.7.1

✨ **重构 Nacos 配置管理**
- 🚀 简化 API 设计，移除 `useHttpMode` 参数
- 📦 提供两层架构：`NacosClient`（基础）+ `EnhancedNacosConfig`（增强）
- 🔒 支持敏感配置 `{{xxx}}` 变量自动解密
- 🌐 使用 HTTP 直连，无需官方 SDK 依赖
- 🛠️ 开箱即用，配置更简洁

## 功能特性

- **AES-128 加密**：高性能敏感数据加密解密
- **TypeORM 装饰器**：`@EncryptedField`、`@EncryptedJsonField` 自动加密字段
- **哈希功能**：SHA256 哈希计算和验证
- **Nacos 配置管理**：双层架构设计，基础配置读取 + 敏感配置解密
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
# 无需额外依赖，开箱即用
```

### Nacos 架构选择

ankerutil-node 提供两层 Nacos 配置管理架构：

1. **🔹 NacosClient（基础层）**
   - 直接的 Nacos 配置读取
   - 适用于简单的配置获取场景
   - 无需初始化，直接使用

2. **🔸 EnhancedNacosConfig（增强层）**
   - 基于 NacosClient 的增强版本
   - 支持敏感配置 `{{xxx}}` 自动解密
   - 需要初始化，提供更多高级功能

**如何选择？**
- 只需要读取普通配置 → 使用 `NacosClient`
- 需要处理敏感配置解密 → 使用 `EnhancedNacosConfig`

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

### Nacos 配置管理

#### 基础配置读取（NacosClient）

```typescript
import { NacosClient } from 'ankerutil-node';

// 基础 Nacos 客户端
const client = new NacosClient({
  serverAddr: '127.0.0.1:8848',
  namespace: 'production',
  username: 'nacos',
  password: 'nacos'
});

// 直接获取配置
const config = await client.getConfig('app.properties');
const jsonConfig = await client.getJsonConfig('database-config.json');

console.log('应用配置:', config);
console.log('数据库配置:', jsonConfig);
```

#### 增强配置管理（支持敏感配置解密）

```typescript
import { EnhancedNacosConfig } from 'ankerutil-node';

// 增强版客户端（自动敏感配置解密）
const enhanced = new EnhancedNacosConfig({
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
  
  // 配置选项
  enableSecretProcessing: true,
  secretFailureStrategy: 'return_original'
});

// 初始化
await enhanced.init();

// 获取配置（自动解密 {{xxx}} 敏感字段）
const config = await enhanced.getConfig('app.properties');
const jsonConfig = await enhanced.getJsonConfig('database-config.json');

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

### 3. Nacos 配置管理

#### NacosClient 类（基础层）
```typescript
import { NacosClient } from 'ankerutil-node';

// 创建基础客户端
const client = new NacosClient(config);

// 基础操作
const config = await client.getConfig(dataId, group?);
const jsonConfig = await client.getJsonConfig<T>(dataId, group?);
const connected = await client.testConnection();
```

#### EnhancedNacosConfig 类（增强层）
```typescript
import { EnhancedNacosConfig } from 'ankerutil-node';

// 创建增强实例
const enhanced = new EnhancedNacosConfig(options);

// 初始化（增强版需要初始化）
await enhanced.init();

// 获取配置（支持敏感配置解密）
const config = await enhanced.getConfig(dataId, group?);
const jsonConfig = await enhanced.getJsonConfig<T>(dataId, group?);

// 敏感配置管理
enhanced.setSecretManager(config);
enhanced.setSecretProcessingEnabled(enabled);
enhanced.isSecretProcessingEnabled(): boolean;

// 获取底层客户端
const nacosClient = enhanced.getNacosClient();

// 测试连接
await enhanced.testConnection();
```

#### 配置选项

**基础配置（NacosClientConfig）：**
```typescript
interface NacosClientConfig {
  serverAddr: string;           // Nacos 服务器地址
  namespace?: string;           // 命名空间（默认 'public'）
  username?: string;            // 用户名
  password?: string;            // 密码
  requestTimeout?: number;      // 请求超时时间（默认 10000ms）
}
```

**增强配置（EnhancedNacosConfigOptions）：**
```typescript
interface EnhancedNacosConfigOptions extends NacosClientConfig {
  // 敏感配置管理（可选）
  secretManager?: {
    Name: string;               // 系统名称
    Key: string;                // 密钥
    Domain: string;             // 服务域名
  };
  
  // 敏感配置选项
  enableSecretProcessing?: boolean;                    // 是否启用敏感配置处理（默认 true）
  secretFailureStrategy?: 'return_original' | 'throw_error';  // 失败策略（默认 'return_original'）
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

### 基础使用（NacosClient）

```typescript
import express from 'express';
import { NacosClient } from 'ankerutil-node';

const app = express();

// 基础 Nacos 客户端
const nacosClient = new NacosClient({
  serverAddr: process.env.NACOS_SERVER || '127.0.0.1:8848',
  namespace: process.env.NACOS_NAMESPACE || 'production',
  username: process.env.NACOS_USERNAME || 'nacos',
  password: process.env.NACOS_PASSWORD || 'nacos'
});

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

### 增强使用（EnhancedNacosConfig）

```typescript
import express from 'express';
import { EnhancedNacosConfig } from 'ankerutil-node';

const app = express();

// 增强版 Nacos 客户端（支持敏感配置解密）
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

// 中间件：注入配置（自动解密敏感字段）
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

### 基础使用（NacosClient）

```typescript
import { Injectable, Module } from '@nestjs/common';
import { NacosClient } from 'ankerutil-node';

@Injectable()
export class ConfigService {
  private nacosClient: NacosClient;

  constructor() {
    this.nacosClient = new NacosClient({
      serverAddr: process.env.NACOS_SERVER || '127.0.0.1:8848',
      namespace: process.env.NACOS_NAMESPACE || 'production',
      username: process.env.NACOS_USERNAME || 'nacos',
      password: process.env.NACOS_PASSWORD || 'nacos'
    });
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

### 增强使用（EnhancedNacosConfig）

```typescript
import { Injectable, Module } from '@nestjs/common';
import { EnhancedNacosConfig } from 'ankerutil-node';

@Injectable()
export class EnhancedConfigService {
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

  // 获取底层客户端用于高级操作
  getNacosClient() {
    return this.nacosClient.getNacosClient();
  }
}

@Module({
  providers: [EnhancedConfigService],
  exports: [EnhancedConfigService]
})
export class EnhancedConfigModule {}
```

## 错误处理

### 配置策略
```typescript
const enhanced = new EnhancedNacosConfig({
  // ... 其他配置
  secretFailureStrategy: 'return_original'  // 或 'throw_error'
});

// 动态切换策略
enhanced.setSecretFailureStrategy('throw_error');
```

### 异常类型
- `NacosConfigError`: Nacos 连接和请求相关错误
- `SecretManageError`: 敏感配置处理错误

### 处理示例
```typescript
import { NacosConfigError, SecretManageError } from 'ankerutil-node';

try {
  const config = await client.getJsonConfig('app-config');
} catch (error) {
  if (error instanceof NacosConfigError) {
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

### v1.7.1
- 🐛 **修复构建问题**
  - 清理旧文件，确保不包含过时的 `http-nacos-client` 模块
  - 确保主项目使用新的 HTTP 直连实现

### v1.7.0
- 🚀 **重构 Nacos 配置管理架构**
  - 简化 API 设计，移除 `useHttpMode` 参数
  - 引入双层架构：`NacosClient`（基础）+ `EnhancedNacosConfig`（增强）
  - 重命名：`HttpNacosClient` → `NacosClient`，命名更直观
- 🔒 **增强敏感配置处理**
  - 支持 `{{xxx}}` 变量自动解密
  - 可配置的失败处理策略
- 🌐 **优化连接方式**
  - 使用 HTTP 直连，移除对官方 SDK 的依赖
  - 提高与各种 Nacos 部署的兼容性
- 🛠️ **改进开发体验**
  - 更清晰的错误类型：`NacosConfigError`、`SecretManageError`
  - 完善的 TypeScript 类型定义
  - 详细的使用文档和示例

### v1.6.x
- 完善 TypeORM 装饰器功能
- 增加哈希验证功能
- 性能优化

## 许可证

MIT License