import { SensitiveData } from '../dist/sensitive_data';

// 基础敏感数据服务类 - 适用于所有框架
export class BaseSensitiveDataService {
  protected sensitiveData: SensitiveData;

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

  encrypt(text: string): string {
    return this.sensitiveData.aes128Sha256EncryptSensitiveData(text);
  }

  decrypt(encryptedText: string): string {
    return this.sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText);
  }
}

// ========== NestJS 7.x 兼容性示例 ==========
export namespace NestJS7Example {
  // 注意：这里只是示例，实际使用时需要安装 @nestjs/common@7.x
  export class SensitiveDataService extends BaseSensitiveDataService {
    // NestJS 7.x 特定功能
    async encryptAsync(text: string): Promise<string> {
      return this.encrypt(text);
    }

    async decryptAsync(encryptedText: string): Promise<string> {
      return this.decrypt(encryptedText);
    }
  }

  // 使用示例（需要 @nestjs/common@7.x）
  /*
  import { Injectable } from '@nestjs/common';
  
  @Injectable()
  export class SensitiveDataService extends BaseSensitiveDataService {
    // 继承基础功能
  }
  
  @Controller('sensitive')
  export class SensitiveController {
    constructor(private readonly sensitiveService: SensitiveDataService) {}
    
    @Post('encrypt')
    async encrypt(@Body() body: { text: string }) {
      const encrypted = await this.sensitiveService.encryptAsync(body.text);
      return { encrypted };
    }
  }
  */
}

// ========== NestJS 9.x 兼容性示例 ==========
export namespace NestJS9Example {
  // 注意：这里只是示例，实际使用时需要安装 @nestjs/common@9.x
  export class SensitiveDataService extends BaseSensitiveDataService {
    // NestJS 9.x 特定功能
    encryptWithMetadata(text: string, metadata?: Record<string, any>): string {
      const encrypted = this.encrypt(text);
      if (metadata) {
        // 可以添加元数据支持
        return encrypted + '|' + JSON.stringify(metadata);
      }
      return encrypted;
    }

    decryptWithMetadata(encryptedText: string): { text: string; metadata?: Record<string, any> } {
      const parts = encryptedText.split('|');
      if (parts.length > 1) {
        const metadata = JSON.parse(parts[1]);
        return { text: this.decrypt(parts[0]), metadata };
      }
      return { text: this.decrypt(encryptedText) };
    }
  }

  // 使用示例（需要 @nestjs/common@9.x）
  /*
  import { Injectable } from '@nestjs/common';
  
  @Injectable()
  export class SensitiveDataService extends BaseSensitiveDataService {
    // 继承基础功能
  }
  
  @Controller('sensitive')
  export class SensitiveController {
    constructor(private readonly sensitiveService: SensitiveDataService) {}
    
    @Post('encrypt')
    async encrypt(@Body() body: { text: string; metadata?: Record<string, any> }) {
      const encrypted = this.sensitiveService.encryptWithMetadata(body.text, body.metadata);
      return { encrypted };
    }
  }
  */
}

// ========== Express.js 4.x 兼容性示例 ==========
export namespace Express4Example {
  // Express.js 4.x 中间件
  export class SensitiveDataMiddleware {
    private sensitiveService: BaseSensitiveDataService;

    constructor() {
      this.sensitiveService = new BaseSensitiveDataService();
    }

    // 加密中间件
    encryptMiddleware = (req: any, res: any, next: any) => {
      if (req.body && req.body.text) {
        req.body.encrypted = this.sensitiveService.encrypt(req.body.text);
      }
      next();
    };

    // 解密中间件
    decryptMiddleware = (req: any, res: any, next: any) => {
      if (req.body && req.body.encrypted) {
        try {
          req.body.decrypted = this.sensitiveService.decrypt(req.body.encrypted);
        } catch (error) {
          return res.status(400).json({ error: '解密失败' });
        }
      }
      next();
    };
  }

  // 使用示例（需要 express@4.x）
  /*
  import express from 'express';
  
  const app = express();
  const sensitiveMiddleware = new SensitiveDataMiddleware();
  
  app.use(express.json());
  app.use('/api/sensitive', sensitiveMiddleware.encryptMiddleware);
  
  app.post('/api/sensitive/encrypt', (req, res) => {
    res.json({ encrypted: req.body.encrypted });
  });
  
  app.post('/api/sensitive/decrypt', sensitiveMiddleware.decryptMiddleware, (req, res) => {
    res.json({ decrypted: req.body.decrypted });
  });
  */
}

// ========== 通用测试函数 ==========
export async function testMultiFrameworkCompatibility() {
  console.log('=== ankerutil-node 多框架兼容性测试 ===\n');

  // 测试基础功能
  const baseService = new BaseSensitiveDataService();
  
  const testCases = [
    { name: '英文文本', text: 'Hello from ankerutil-node!' },
    { name: '中文文本', text: '这是中文测试文本' },
    { name: 'JSON数据', text: '{"name": "张三", "age": 25}' },
    { name: '特殊字符', text: '!@#$%^&*()_+-=[]{}|;:\'",./<>?' },
    { name: '空字符串', text: '' },
    { name: '换行符', text: '\n\t\r' }
  ];

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    console.log(`原始文本: "${testCase.text}"`);
    
    const encrypted = baseService.encrypt(testCase.text);
    console.log(`加密结果: ${encrypted}`);
    
    const decrypted = baseService.decrypt(encrypted);
    console.log(`解密结果: "${decrypted}"`);
    
    const isMatch = testCase.text === decrypted;
    console.log(`验证结果: ${isMatch ? '✅ 成功' : '❌ 失败'}`);
    console.log('');
  }

  // 测试 NestJS 7.x 功能
  console.log('=== NestJS 7.x 功能测试 ===');
  const nestjs7Service = new NestJS7Example.SensitiveDataService();
  const testText = 'NestJS 7.x 测试';
  const encrypted7 = await nestjs7Service.encryptAsync(testText);
  const decrypted7 = await nestjs7Service.decryptAsync(encrypted7);
  console.log(`NestJS 7.x 异步加密解密: ${testText === decrypted7 ? '✅ 成功' : '❌ 失败'}`);
  console.log('');

  // 测试 NestJS 9.x 功能
  console.log('=== NestJS 9.x 功能测试 ===');
  const nestjs9Service = new NestJS9Example.SensitiveDataService();
  const metadata = { userId: 123, timestamp: Date.now() };
  const encrypted9 = nestjs9Service.encryptWithMetadata(testText, metadata);
  const result9 = nestjs9Service.decryptWithMetadata(encrypted9);
  console.log(`NestJS 9.x 元数据支持: ${testText === result9.text && JSON.stringify(metadata) === JSON.stringify(result9.metadata) ? '✅ 成功' : '❌ 失败'}`);
  console.log('');

  // 测试 Express.js 4.x 功能
  console.log('=== Express.js 4.x 功能测试 ===');
  const expressMiddleware = new Express4Example.SensitiveDataMiddleware();
  const mockReq: any = { body: { text: 'Express.js 4.x 测试' } };
  const mockRes = { status: () => ({ json: () => {} }) };
  const mockNext = () => {};
  
  expressMiddleware.encryptMiddleware(mockReq, mockRes, mockNext);
  console.log(`Express.js 4.x 中间件: ${mockReq.body.encrypted ? '✅ 成功' : '❌ 失败'}`);
  console.log('');

  console.log('=== 所有框架兼容性测试完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  testMultiFrameworkCompatibility().catch(console.error);
} 