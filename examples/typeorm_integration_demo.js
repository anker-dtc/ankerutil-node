// TypeORM集成使用示例
console.log('=== TypeORM集成使用示例 ===\n');

// 模拟TypeORM集成模块
class TypeORMIntegrationBuilder {
  constructor() {
    this.options = {};
  }

  setDatabase(database) {
    this.options.database = database;
    return this;
  }

  setNacos(nacos) {
    this.options.nacos = nacos;
    return this;
  }

  setEncryptedConfig(encryptedConfigDataId, encryptedConfigGroup) {
    this.options.encryptedConfigDataId = encryptedConfigDataId;
    this.options.encryptedConfigGroup = encryptedConfigGroup;
    return this;
  }

  setEntities(entities) {
    this.options.entities = entities;
    return this;
  }

  setSensitiveFields(sensitiveFields) {
    this.options.sensitiveFields = sensitiveFields;
    return this;
  }

  setAutoRegisterSensitiveSubscriber(autoRegister) {
    this.options.autoRegisterSensitiveSubscriber = autoRegister;
    return this;
  }

  build() {
    return new TypeORMIntegration(this.options);
  }
}

class TypeORMIntegration {
  constructor(options) {
    this.options = {
      autoRegisterSensitiveSubscriber: true,
      encryptedConfigGroup: 'DEFAULT_GROUP',
      ...options
    };
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    console.log('初始化TypeORM集成...');
    console.log('数据库配置:', this.options.database.type);
    console.log('实体数量:', this.options.entities.length);
    console.log('敏感字段配置:', this.options.sensitiveFields.size);

    // 模拟初始化过程
    this.sensitiveData = new MockSensitiveData();
    this.dataSource = new MockDataSource(this.options);

    this.isInitialized = true;
    console.log('TypeORM集成初始化成功');
  }

  getDataSource() {
    if (!this.isInitialized) {
      throw new Error('TypeORM集成尚未初始化');
    }
    return this.dataSource;
  }

  getSensitiveData() {
    if (!this.isInitialized) {
      throw new Error('TypeORM集成尚未初始化');
    }
    return this.sensitiveData;
  }

  async close() {
    if (this.dataSource) {
      await this.dataSource.destroy();
    }
    this.isInitialized = false;
    console.log('TypeORM集成已关闭');
  }
}

// 模拟敏感数据处理器
class MockSensitiveData {
  encrypt(data) {
    return `ENCRYPTED_${data}_${Date.now()}`;
  }

  decrypt(data) {
    if (data.startsWith('ENCRYPTED_')) {
      return data.replace(/^ENCRYPTED_(.+)_\d+$/, '$1');
    }
    return data;
  }
}

// 模拟DataSource
class MockDataSource {
  constructor(options) {
    this.options = options;
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
    console.log('Mock DataSource 初始化成功');
    console.log('实体:', this.options.entities.map(e => e.name));
    console.log('Subscribers:', this.options.autoRegisterSensitiveSubscriber ? 1 : 0);
  }

  async destroy() {
    this.isInitialized = false;
    console.log('Mock DataSource 已关闭');
  }
}

// 模拟实体类
class User {
  constructor(data = {}) {
    Object.assign(this, data);
  }
}

class Employee {
  constructor(data = {}) {
    Object.assign(this, data);
  }
}

// 使用示例
async function demonstrateIntegration() {
  console.log('=== 构建器模式配置 ===');

  // 使用构建器模式创建集成
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

  // 初始化集成
  await integration.initialize();

  // 获取组件
  const dataSource = integration.getDataSource();
  const sensitiveData = integration.getSensitiveData();

  console.log('\n=== 功能验证 ===');

  // 测试敏感数据加密/解密
  const testPassword = 'secret123';
  const encrypted = sensitiveData.encrypt(testPassword);
  const decrypted = sensitiveData.decrypt(encrypted);

  console.log('敏感数据测试:');
  console.log('  原始密码:', testPassword);
  console.log('  加密后:', encrypted);
  console.log('  解密后:', decrypted);
  console.log('  验证结果:', testPassword === decrypted ? '✅ 成功' : '❌ 失败');

  // 测试实体敏感字段处理
  const user = new User({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secret123',
    phone: '13800138000',
    secretKey: 'api_key_123'
  });

  console.log('\n实体敏感字段测试:');
  console.log('  原始用户数据:');
  console.log('    name:', user.name);
  console.log('    email:', user.email);
  console.log('    password:', user.password);
  console.log('    phone:', user.phone);
  console.log('    secretKey:', user.secretKey);

  // 模拟Subscriber的beforeInsert事件
  const sensitiveFields = ['password', 'phone', 'secretKey'];
  for (const field of sensitiveFields) {
    if (user[field]) {
      user[field] = sensitiveData.encrypt(user[field]);
    }
  }

  console.log('\n  加密后用户数据:');
  console.log('    name:', user.name);
  console.log('    email:', user.email);
  console.log('    password:', user.password);
  console.log('    phone:', user.phone);
  console.log('    secretKey:', user.secretKey);

  // 模拟Subscriber的afterLoad事件
  for (const field of sensitiveFields) {
    if (user[field]) {
      user[field] = sensitiveData.decrypt(user[field]);
    }
  }

  console.log('\n  解密后用户数据:');
  console.log('    name:', user.name);
  console.log('    email:', user.email);
  console.log('    password:', user.password);
  console.log('    phone:', user.phone);
  console.log('    secretKey:', user.secretKey);

  // 关闭连接
  await integration.close();

  console.log('\n=== 集成优势 ===');
  console.log('1. 一键配置: 通过构建器模式简化配置');
  console.log('2. 自动Subscriber: 自动注册敏感数据Subscriber');
  console.log('3. 装饰器支持: 支持自定义敏感字段装饰器');
  console.log('4. 类型安全: 完整的TypeScript类型支持');
  console.log('5. 灵活扩展: 支持多个实体和不同的敏感字段配置');

  console.log('\n=== 在真实项目中的使用 ===');
  console.log(`
// 1. 安装依赖
npm install ankerutil-node typeorm

// 2. 在宿主项目中配置
import { TypeORMIntegrationBuilder } from 'ankerutil-node';
import { DataSource } from 'typeorm';
import { User, Employee } from './entities';

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

// 设置DataSource工厂
integration.setDataSourceFactory((options) => new DataSource(options));

// 初始化
await integration.initialize();

// 使用
const dataSource = integration.getDataSource();
const userRepository = dataSource.getRepository(User);

// 自动加密/解密
const user = await userRepository.save({
  name: 'John',
  password: 'secret123', // 自动加密
  phone: '13800138000'   // 自动加密
});

const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password); // 自动解密: 'secret123'
  `);
}

// 运行示例
demonstrateIntegration().catch(console.error); 