# ankerutil-node 多框架集成指南

## 概述

ankerutil-node SDK 已完全兼容 Node.js 22，并支持在以下框架中使用：
- NestJS 7.x
- NestJS 9.x  
- Express.js 4.x

## 安装

```bash
npm install ankerutil-node
```

## 基础使用

所有框架都基于相同的核心功能：

```typescript
import { SensitiveData } from 'ankerutil-node';

const sensitiveData = new SensitiveData();
const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const rootKey = {
  "0001": "0123456789abcdef0123456789abcdef"
};
sensitiveData.initSensitiveKey(cbcKey, rootKey);

// 加密
const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData("敏感数据");
// 解密
const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
```

---

## NestJS 7.x 集成

### 1. 安装依赖

```bash
npm install @nestjs/common@7 @nestjs/core@7 @nestjs/platform-express@7
```

### 2. 创建服务

```typescript
// sensitive-data.service.ts
import { Injectable } from '@nestjs/common';
import { SensitiveData } from 'ankerutil-node';

@Injectable()
export class SensitiveDataService {
  private sensitiveData: SensitiveData;

  constructor() {
    this.sensitiveData = new SensitiveData();
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    this.sensitiveData.initSensitiveKey(cbcKey, rootKey);
  }

  async encrypt(text: string): Promise<string> {
    return this.sensitiveData.aes128Sha256EncryptSensitiveData(text);
  }

  async decrypt(encryptedText: string): Promise<string> {
    return this.sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText);
  }
}
```

### 3. 创建控制器

```typescript
// sensitive.controller.ts
import { Controller, Post, Body, Get } from '@nestjs/common';
import { SensitiveDataService } from './sensitive-data.service';

export class EncryptDto {
  text: string;
}

export class DecryptDto {
  encryptedText: string;
}

@Controller('sensitive')
export class SensitiveController {
  constructor(private readonly sensitiveDataService: SensitiveDataService) {}

  @Post('encrypt')
  async encrypt(@Body() encryptDto: EncryptDto) {
    const encrypted = await this.sensitiveDataService.encrypt(encryptDto.text);
    return {
      success: true,
      data: {
        original: encryptDto.text,
        encrypted: encrypted
      }
    };
  }

  @Post('decrypt')
  async decrypt(@Body() decryptDto: DecryptDto) {
    try {
      const decrypted = await this.sensitiveDataService.decrypt(decryptDto.encryptedText);
      return {
        success: true,
        data: {
          encrypted: decryptDto.encryptedText,
          decrypted: decrypted
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  @Get('test')
  async test() {
    const testText = "NestJS 7.x 测试";
    const encrypted = await this.sensitiveDataService.encrypt(testText);
    const decrypted = await this.sensitiveDataService.decrypt(encrypted);
    
    return {
      success: true,
      data: {
        original: testText,
        encrypted: encrypted,
        decrypted: decrypted,
        isMatch: testText === decrypted
      }
    };
  }
}
```

### 4. 注册模块

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { SensitiveController } from './sensitive.controller';
import { SensitiveDataService } from './sensitive-data.service';

@Module({
  controllers: [SensitiveController],
  providers: [SensitiveDataService],
})
export class AppModule {}
```

---

## NestJS 9.x 集成

### 1. 安装依赖

```bash
npm install @nestjs/common@9 @nestjs/core@9 @nestjs/platform-express@9
```

### 2. 增强服务（支持元数据）

```typescript
// sensitive-data.service.ts
import { Injectable } from '@nestjs/common';
import { SensitiveData } from 'ankerutil-node';

@Injectable()
export class SensitiveDataService {
  private sensitiveData: SensitiveData;

  constructor() {
    this.sensitiveData = new SensitiveData();
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    this.sensitiveData.initSensitiveKey(cbcKey, rootKey);
  }

  // 基础加密解密
  async encrypt(text: string): Promise<string> {
    return this.sensitiveData.aes128Sha256EncryptSensitiveData(text);
  }

  async decrypt(encryptedText: string): Promise<string> {
    return this.sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText);
  }

  // 带元数据的加密解密（NestJS 9.x 特性）
  async encryptWithMetadata(text: string, metadata?: Record<string, any>): Promise<string> {
    const encrypted = await this.encrypt(text);
    if (metadata) {
      return encrypted + '|' + JSON.stringify(metadata);
    }
    return encrypted;
  }

  async decryptWithMetadata(encryptedText: string): Promise<{ text: string; metadata?: Record<string, any> }> {
    const parts = encryptedText.split('|');
    if (parts.length > 1) {
      const metadata = JSON.parse(parts[1]);
      return { text: await this.decrypt(parts[0]), metadata };
    }
    return { text: await this.decrypt(encryptedText) };
  }
}
```

### 3. 控制器（支持元数据）

```typescript
// sensitive.controller.ts
import { Controller, Post, Body, Get } from '@nestjs/common';
import { SensitiveDataService } from './sensitive-data.service';

export class EncryptDto {
  text: string;
  metadata?: Record<string, any>;
}

export class DecryptDto {
  encryptedText: string;
}

@Controller('sensitive')
export class SensitiveController {
  constructor(private readonly sensitiveDataService: SensitiveDataService) {}

  @Post('encrypt')
  async encrypt(@Body() encryptDto: EncryptDto) {
    const encrypted = await this.sensitiveDataService.encryptWithMetadata(
      encryptDto.text, 
      encryptDto.metadata
    );
    return {
      success: true,
      data: {
        original: encryptDto.text,
        encrypted: encrypted,
        metadata: encryptDto.metadata
      }
    };
  }

  @Post('decrypt')
  async decrypt(@Body() decryptDto: DecryptDto) {
    try {
      const result = await this.sensitiveDataService.decryptWithMetadata(decryptDto.encryptedText);
      return {
        success: true,
        data: {
          encrypted: decryptDto.encryptedText,
          decrypted: result.text,
          metadata: result.metadata
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}
```

---

## Express.js 4.x 集成

### 1. 安装依赖

```bash
npm install express@4 @types/express
```

### 2. 创建中间件

```typescript
// sensitive-middleware.ts
import { Request, Response, NextFunction } from 'express';
import { SensitiveData } from 'ankerutil-node';

export class SensitiveDataMiddleware {
  private sensitiveData: SensitiveData;

  constructor() {
    this.sensitiveData = new SensitiveData();
    this.initializeKeys();
  }

  private initializeKeys(): void {
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    this.sensitiveData.initSensitiveKey(cbcKey, rootKey);
  }

  // 加密中间件
  encryptMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.text) {
      req.body.encrypted = this.sensitiveData.aes128Sha256EncryptSensitiveData(req.body.text);
    }
    next();
  };

  // 解密中间件
  decryptMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.encrypted) {
      try {
        req.body.decrypted = this.sensitiveData.aes128Sha256DecryptSensitiveData(req.body.encrypted);
      } catch (error) {
        return res.status(400).json({ error: '解密失败', details: error.message });
      }
    }
    next();
  };

  // 直接加密方法
  encrypt(text: string): string {
    return this.sensitiveData.aes128Sha256EncryptSensitiveData(text);
  }

  // 直接解密方法
  decrypt(encryptedText: string): string {
    return this.sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText);
  }
}
```

### 3. 创建应用

```typescript
// app.ts
import express from 'express';
import { SensitiveDataMiddleware } from './sensitive-middleware';

const app = express();
const sensitiveMiddleware = new SensitiveDataMiddleware();

// 中间件
app.use(express.json());

// 路由
app.post('/api/sensitive/encrypt', sensitiveMiddleware.encryptMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      original: req.body.text,
      encrypted: req.body.encrypted
    }
  });
});

app.post('/api/sensitive/decrypt', sensitiveMiddleware.decryptMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      encrypted: req.body.encrypted,
      decrypted: req.body.decrypted
    }
  });
});

app.get('/api/sensitive/test', (req, res) => {
  const testText = "Express.js 4.x 测试";
  const encrypted = sensitiveMiddleware.encrypt(testText);
  const decrypted = sensitiveMiddleware.decrypt(encrypted);
  
  res.json({
    success: true,
    data: {
      original: testText,
      encrypted: encrypted,
      decrypted: decrypted,
      isMatch: testText === decrypted
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express.js 服务器运行在端口 ${PORT}`);
});
```

---

## 环境变量配置

建议将密钥配置在环境变量中：

```typescript
// config.ts
export const sensitiveConfig = {
  cbcKey: process.env.SENSITIVE_CBC_KEY || "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  rootKey: {
    "0001": process.env.SENSITIVE_ROOT_KEY || "0123456789abcdef0123456789abcdef"
  }
};
```

## 错误处理

所有框架都支持统一的错误处理：

```typescript
try {
  const decrypted = sensitiveData.decrypt(encryptedText);
  return { success: true, data: decrypted };
} catch (error) {
  return { 
    success: false, 
    error: error.message,
    code: 'DECRYPT_FAILED'
  };
}
```

## 测试

每个框架都包含完整的测试用例，确保功能正常：

```bash
# 运行基础测试
npm test

# 运行多框架兼容性测试
npx ts-node examples/multi-framework-compatibility.ts
```

## 注意事项

1. **密钥管理**：生产环境中请使用安全的密钥管理方案
2. **错误处理**：始终包含适当的错误处理机制
3. **性能考虑**：加密解密操作是CPU密集型，考虑使用缓存
4. **版本兼容性**：确保Node.js版本 >= 18.0.0

## 支持

如果遇到任何问题，请检查：
- Node.js版本（推荐 >= 18.0.0）
- TypeScript版本（推荐 >= 5.0.0）
- 框架版本兼容性
- 密钥配置是否正确 