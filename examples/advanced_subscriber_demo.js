// 高级Subscriber使用示例
console.log('=== 高级Subscriber使用示例 ===\n');

// 模拟高级Subscriber功能
class AdvancedEncryptionSubscriber {
  constructor(encryptionService, logger) {
    this.encryptionService = encryptionService;
    this.logger = logger || console;
  }

  // 加密普通字段
  async encryptField(entity, field, options) {
    if (!options.autoEncrypt || entity[field] == null) return;
    
    try {
      entity[field] = this.encryptionService.encrypt(String(entity[field]));
    } catch (error) {
      throw new Error(`Failed to encrypt field: ${error.message}`);
    }
  }

  // 解密普通字段
  async decryptField(entity, field, options) {
    if (entity[field] == null) return;
    
    const originalValue = entity[field];
    try {
      const decryptedValue = this.encryptionService.decrypt(String(originalValue));
      
      if (decryptedValue !== null && decryptedValue !== undefined && decryptedValue !== '') {
        entity[field] = decryptedValue;
      } else {
        entity[field] = originalValue;
        this.logger.warn(`解密结果为空，保持原值，字段: ${field}`);
      }
    } catch (error) {
      entity[field] = originalValue;
      this.logger.warn(`解密失败，保持原值，字段: ${field}, 错误: ${error.message}`);
    }
  }

  // 处理JSON路径加密
  async processJsonPath(obj, path, operation) {
    const segments = path.split('.');
    let current = obj;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      if (segment.includes('[')) {
        // 处理数组路径，如 'items[0].name'
        const arrayMatch = segment.match(/(\w+)\[(\d+)\]/);
        if (arrayMatch) {
          const [, arrayName, index] = arrayMatch;
          current = current[arrayName][parseInt(index)];
        }
      } else {
        current = current[segment];
      }
    }
    
    const lastSegment = segments[segments.length - 1];
    if (operation === 'encrypt') {
      current[lastSegment] = this.encryptionService.encrypt(current[lastSegment]);
    } else {
      current[lastSegment] = this.encryptionService.decrypt(current[lastSegment]);
    }
  }

  // 加密JSON字段
  async encryptJsonField(entity, field, options) {
    if (!options.autoEncrypt || entity[field] == null) return;
    
    for (const path of options.paths) {
      await this.processJsonPath(entity[field], path, 'encrypt');
    }
  }

  // 解密JSON字段
  async decryptJsonField(entity, field, options) {
    if (entity[field] == null) return;
    
    for (const path of options.paths) {
      await this.processJsonPath(entity[field], path, 'decrypt');
    }
  }

  // 插入前加密
  async beforeInsert(event) {
    const entity = event.entity;
    if (!entity) return;

    // 处理普通加密字段
    const encryptedFields = entity.constructor.__encryptedFields || [];
    for (const { field, options } of encryptedFields) {
      await this.encryptField(entity, field, options);
    }

    // 处理JSON加密字段
    const encryptedJsonFields = entity.constructor.__encryptedJsonFields || [];
    for (const { field, options } of encryptedJsonFields) {
      await this.encryptJsonField(entity, field, options);
    }
  }

  // 加载后解密
  async afterLoad(entity) {
    if (!entity) return;

    // 处理普通加密字段
    const encryptedFields = entity.constructor.__encryptedFields || [];
    for (const { field, options } of encryptedFields) {
      await this.decryptField(entity, field, options);
    }

    // 处理JSON加密字段
    const encryptedJsonFields = entity.constructor.__encryptedJsonFields || [];
    for (const { field, options } of encryptedJsonFields) {
      await this.decryptJsonField(entity, field, options);
    }
  }
}

// 装饰器工厂函数
function createEncryptedFieldDecorator(options = {}) {
  return function(target, propertyKey) {
    if (!target.constructor.__encryptedFields) {
      target.constructor.__encryptedFields = [];
    }
    target.constructor.__encryptedFields.push({ field: propertyKey, options });
  };
}

function createEncryptedJsonFieldDecorator(options) {
  return function(target, propertyKey) {
    if (!target.constructor.__encryptedJsonFields) {
      target.constructor.__encryptedJsonFields = [];
    }
    target.constructor.__encryptedJsonFields.push({ field: propertyKey, options });
  };
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

// 创建装饰器
const EncryptedField = createEncryptedFieldDecorator({ autoEncrypt: true });
const EncryptedJsonField = createEncryptedJsonFieldDecorator({
  autoEncrypt: true,
  paths: ['items[0].name', 'items[1].name', 'metadata.secret']
});

// 定义实体类
class User {
  constructor(data = {}) {
    Object.assign(this, data);
  }
}

// 手动应用装饰器效果
EncryptedField(User.prototype, 'password');
EncryptedField(User.prototype, 'phone');
EncryptedJsonField(User.prototype, 'profile');

// 使用示例
async function demonstrateAdvancedSubscriber() {
  console.log('=== 高级Subscriber功能演示 ===\n');

  // 创建Subscriber
  const sensitiveData = new MockSensitiveData();
  const subscriber = new AdvancedEncryptionSubscriber(sensitiveData, console);

  // 创建用户数据
  const user = new User({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secret123',
    phone: '13800138000',
    profile: {
      items: [
        { id: 1, name: 'item1_secret' },
        { id: 2, name: 'item2_secret' }
      ],
      metadata: {
        secret: 'metadata_secret_value'
      }
    }
  });

  console.log('原始用户数据:');
  console.log('  name:', user.name);
  console.log('  email:', user.email);
  console.log('  password:', user.password);
  console.log('  phone:', user.phone);
  console.log('  profile:', JSON.stringify(user.profile, null, 2));
  console.log('');

  // 模拟beforeInsert事件
  console.log('模拟 beforeInsert 事件...');
  await subscriber.beforeInsert({ entity: user });

  console.log('加密后用户数据:');
  console.log('  name:', user.name);
  console.log('  email:', user.email);
  console.log('  password:', user.password);
  console.log('  phone:', user.phone);
  console.log('  profile:', JSON.stringify(user.profile, null, 2));
  console.log('');

  // 模拟afterLoad事件
  console.log('模拟 afterLoad 事件...');
  await subscriber.afterLoad(user);

  console.log('解密后用户数据:');
  console.log('  name:', user.name);
  console.log('  email:', user.email);
  console.log('  password:', user.password);
  console.log('  phone:', user.phone);
  console.log('  profile:', JSON.stringify(user.profile, null, 2));
  console.log('');

  // 验证数据完整性
  const isCorrect = 
    user.password === 'secret123' &&
    user.phone === '13800138000' &&
    user.profile.items[0].name === 'item1_secret' &&
    user.profile.items[1].name === 'item2_secret' &&
    user.profile.metadata.secret === 'metadata_secret_value';

  console.log(`数据完整性验证: ${isCorrect ? '✅ 通过' : '❌ 失败'}`);

  console.log('\n=== 高级Subscriber特性 ===');
  console.log('1. 普通字段加密: 支持简单的字符串字段加密/解密');
  console.log('2. JSON路径加密: 支持复杂的JSON结构中的特定路径加密');
  console.log('3. 数组支持: 支持数组元素的加密，如 items[0].name');
  console.log('4. 错误处理: 解密失败时保持原值，记录警告日志');
  console.log('5. 装饰器支持: 通过装饰器自动标记需要加密的字段');
  console.log('6. 灵活配置: 支持不同的加密选项和路径配置');

  console.log('\n=== 在真实项目中的使用 ===');
  console.log(`
// 1. 定义实体
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

// 2. 配置集成
const integration = new TypeORMIntegrationBuilder()
  .setDatabase({...})
  .setNacos({...})
  .setEncryptedConfig('ankerutil-keys')
  .setEntities([User])
  .setUseAdvancedSubscriber(true)  // 启用高级Subscriber
  .setLogger(logger)               // 设置日志器
  .build();

// 3. 使用
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

// 查询时自动解密
const savedUser = await userRepository.findOne({ where: { id: 1 } });
console.log(savedUser.password);   // 自动解密: 'secret123'
console.log(savedUser.profile.items[0].name); // 自动解密: 'item1_secret'
  `);
}

// 运行示例
demonstrateAdvancedSubscriber().catch(console.error); 