# ankerutil-node

Node.js 敏感数据加密工具库 - 提供AES加密、TypeORM装饰器、哈希功能和Nacos配置读取

## 版本 v1.7.0

✨ **新增 Nacos 配置管理**
- 支持从 Nacos 配置中心读取配置
- 支持敏感配置 `{{xxx}}` 变量解密
- 提供 Express.js/NestJS 集成示例

## 功能特性

- **AES-128 加密**：高性能敏感数据加密解密
- **TypeORM 装饰器**：`@EncryptedField`、`@EncryptedJsonField` 自动加密字段
- **哈希功能**：SHA256 哈希计算和验证
- **Nacos 配置**：支持配置读取、监听和敏感配置解密
- **Node.js 18+ 兼容**

## 快速开始

### 安装

```bash
npm install ankerutil-node
# 使用Nacos功能需要额外安装
npm install nacos
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

@Entity('users')
export class User {
  @EncryptedField({ hashField: 'email_hash' })
  email: string;

  @EncryptedJsonField({ 
    paths: ['password', 'profile.phone'],
    hashField: 'data_hash'
  })
  @Column({ type: 'jsonb' })
  userData: object;
}

// 注册订阅器
TypeOrmModule.forRoot({
  subscribers: [new EncryptionSubscriber(encryption)]
});
```

### Nacos 配置读取

#### 基础用法

```typescript
import { NacosConfig } from 'ankerutil-node';

const nacosConfig = new NacosConfig({
  serverAddr: '127.0.0.1:8848',
  namespace: 'production'
});

await nacosConfig.init();
const config = await nacosConfig.getConfig('app.properties');
const jsonConfig = await nacosConfig.getJsonConfig('database.json');

// 监听配置变更
await nacosConfig.subscribe({
  dataId: 'app.properties',
  onChanged: (content) => console.log('配置更新:', content)
});
```

#### 敏感配置解密

```typescript
import { EnhancedNacosConfig } from 'ankerutil-node';

const enhancedClient = new EnhancedNacosConfig({
  serverAddr: process.env.NACOS_SERVER_ADDR!,
  namespace: process.env.NACOS_NAMESPACE!,
  username: process.env.NACOS_USERNAME,
  password: process.env.NACOS_PASSWORD,
  secretManager: {
    Name: process.env.SECRET_MANAGE_NAME!,
    Key: process.env.SECRET_MANAGE_KEY!,
    Domain: process.env.SECRET_MANAGE_DOMAIN!
  }
});

await enhancedClient.init();
// 自动解密配置中的 {{encrypted_value}} 变量
const config = await enhancedClient.getConfig('app.properties');
```

### Express.js 集成

```typescript
import express from 'express';
import { createAndInitEnhancedNacosConfig } from 'ankerutil-node';

const app = express();

const nacosClient = await createAndInitEnhancedNacosConfig({
  serverAddr: process.env.NACOS_SERVER_ADDR!,
  namespace: process.env.NACOS_NAMESPACE!,
  username: process.env.NACOS_USERNAME,
  password: process.env.NACOS_PASSWORD,
  secretManager: {
    Name: process.env.SECRET_MANAGE_NAME!,
    Key: process.env.SECRET_MANAGE_KEY!,
    Domain: process.env.SECRET_MANAGE_DOMAIN!
  }
});

let appConfig = await nacosClient.getJsonConfig('app-config');
app.get('/config', (req, res) => res.json(appConfig));
```

### NestJS 集成

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EnhancedNacosConfig, createAndInitEnhancedNacosConfig } from 'ankerutil-node';

@Injectable()
export class ConfigService implements OnModuleInit {
  private nacosClient: EnhancedNacosConfig;
  private config: any = {};

  async onModuleInit() {
    this.nacosClient = await createAndInitEnhancedNacosConfig({
      serverAddr: process.env.NACOS_SERVER_ADDR!,
      namespace: process.env.NACOS_NAMESPACE!,
      username: process.env.NACOS_USERNAME,
      password: process.env.NACOS_PASSWORD,
      secretManager: {
        Name: process.env.SECRET_MANAGE_NAME!,
        Key: process.env.SECRET_MANAGE_KEY!,
        Domain: process.env.SECRET_MANAGE_DOMAIN!
      }
    });
    
    this.config = await this.nacosClient.getJsonConfig('app-config');
  }

  getConfig(key?: string) {
    return key ? this.config[key] : this.config;
  }
}
```

## 配置格式

### 敏感配置格式

支持在配置中使用 `{{变量名}}` 形式的敏感字段：

```json
{
  "SecretManage": {
    "Key": "your-secret-key",
    "Domain": "https://your-secret-service.com",
    "Name": "your-system-name"
  },
  "database": {
    "host": "localhost",
    "password": "{{encrypted_db_password}}"
  },
  "redis": {
    "password": "{{encrypted_redis_password}}"
  }
}
```

支持 JSON、YAML、INI 三种格式。

## API 参考

### Encryption

```typescript
class Encryption {
  init(cbcKey: string, rootKey: { [version: string]: string }): void;
  encrypt(text: string): string | null;
  decrypt(encryptedText: string): string | null;
}
```

### Hash

```typescript
class Hash {
  static sha256(text: string, encoding?: 'hex' | 'base64'): string | null;
  static normalizeSha256(text: string, encoding?: 'hex' | 'base64'): string | null;
  static verifyNormalized(text: string, expectedHash: string, encoding?: 'hex' | 'base64'): boolean;
}
```

### NacosConfig

```typescript
class NacosConfig {
  constructor(options: NacosConfigOptions);
  init(): Promise<void>;
  getConfig(dataId: string, group?: string): Promise<string | null>;
  getJsonConfig<T>(dataId: string, group?: string): Promise<T | null>;
  subscribe(param: { dataId: string; group?: string; onChanged: (content: string) => void }): Promise<void>;
  close(): Promise<void>;
}
```

### EnhancedNacosConfig

继承 `NacosConfig` 的所有方法，额外支持：

```typescript
class EnhancedNacosConfig extends NacosConfig {
  // 支持敏感配置解密的配置读取
  // subscribe 回调增加 isDecrypted 参数
  subscribe(param: { 
    dataId: string; 
    group?: string; 
    onChanged: (content: string, isDecrypted?: boolean) => void 
  }): Promise<void>;
}
```

## 环境变量配置

外部项目需要在环境变量中配置以下变量：

```bash
# Nacos 服务器配置
NACOS_SERVER_ADDR=44.230.8.14:8848
NACOS_NAMESPACE=beta-us
NACOS_USERNAME=dev
NACOS_PASSWORD=rEiUcgAt6nKTBZ77dpKae8irnTKwgPzs

# 敏感配置管理（可选）
SECRET_MANAGE_NAME=DTC
SECRET_MANAGE_KEY=118c02b71e211049304bd70a0c971d77
SECRET_MANAGE_DOMAIN=https://vsaas-api-ci.eufylife.com
```

然后在代码中通过 `process.env` 读取并传入配置：

```typescript
const nacosClient = new EnhancedNacosConfig({
  serverAddr: process.env.NACOS_SERVER_ADDR!,
  namespace: process.env.NACOS_NAMESPACE!,
  username: process.env.NACOS_USERNAME,
  password: process.env.NACOS_PASSWORD,
  secretManager: {
    Name: process.env.SECRET_MANAGE_NAME!,
    Key: process.env.SECRET_MANAGE_KEY!,
    Domain: process.env.SECRET_MANAGE_DOMAIN!
  }
});
```

## 许可证

MIT