// 简化的 TypeORM Subscriber 结合装饰器使用示例
console.log('=== TypeORM Subscriber 结合装饰器使用示例 ===\n');

// 模拟 TypeORM 装饰器功能
function Entity(tableName) {
  return function(target) {
    target.tableName = tableName;
    console.log(`实体 ${target.name} 映射到表 ${tableName}`);
  };
}

function Column(options = {}) {
  return function(target, propertyKey) {
    if (!target.columns) target.columns = [];
    target.columns.push({ name: propertyKey, ...options });
  };
}

function PrimaryGeneratedColumn() {
  return function(target, propertyKey) {
    if (!target.columns) target.columns = [];
    target.columns.push({ name: propertyKey, primary: true, generated: true });
  };
}

function CreateDateColumn() {
  return function(target, propertyKey) {
    if (!target.columns) target.columns = [];
    target.columns.push({ name: propertyKey, type: 'timestamp', default: 'CURRENT_TIMESTAMP' });
  };
}

function UpdateDateColumn() {
  return function(target, propertyKey) {
    if (!target.columns) target.columns = [];
    target.columns.push({ name: propertyKey, type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' });
  };
}

// 自定义装饰器标记敏感字段
function SensitiveField() {
  return function(target, propertyKey) {
    if (!target.sensitiveFields) target.sensitiveFields = [];
    target.sensitiveFields.push(propertyKey);
  };
}

// 使用装饰器定义用户实体（在实际TypeScript项目中会这样写）
// @Entity('users')
// class User {
//   @PrimaryGeneratedColumn()
//   id;
//   @Column({ type: 'varchar', length: 100 })
//   name;
//   @Column({ type: 'varchar', length: 255, unique: true })
//   email;
//   @Column({ type: 'varchar', length: 255 })
//   @SensitiveField()
//   password;
//   @Column({ type: 'varchar', length: 20 })
//   @SensitiveField()
//   phone;
//   @Column({ type: 'varchar', length: 255 })
//   @SensitiveField()
//   secretKey;
//   @CreateDateColumn()
//   createdAt;
//   @UpdateDateColumn()
//   updatedAt;
// }

// 在JavaScript中模拟装饰器效果
class User {
  constructor(data = {}) {
    Object.assign(this, data);
  }
}

// 手动应用装饰器效果
Entity('users')(User);
PrimaryGeneratedColumn()(User.prototype, 'id');
Column({ type: 'varchar', length: 100 })(User.prototype, 'name');
Column({ type: 'varchar', length: 255, unique: true })(User.prototype, 'email');
Column({ type: 'varchar', length: 255 })(User.prototype, 'password');
SensitiveField()(User.prototype, 'password');
Column({ type: 'varchar', length: 20 })(User.prototype, 'phone');
SensitiveField()(User.prototype, 'phone');
Column({ type: 'varchar', length: 255 })(User.prototype, 'secretKey');
SensitiveField()(User.prototype, 'secretKey');
CreateDateColumn()(User.prototype, 'createdAt');
UpdateDateColumn()(User.prototype, 'updatedAt');

// 模拟敏感数据处理器
class SensitiveDataHandler {
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

// 敏感数据 Subscriber
class SensitiveDataSubscriber {
  constructor() {
    this.sensitiveData = new SensitiveDataHandler();
    console.log('敏感数据 Subscriber 初始化成功');
  }

  // 监听用户实体
  listenTo() {
    return User;
  }

  // 插入前加密敏感数据
  beforeInsert(event) {
    const user = event.entity;
    this.encryptSensitiveFields(user);
    console.log('用户数据插入前加密完成');
  }

  // 更新前加密敏感数据
  beforeUpdate(event) {
    const user = event.entity;
    this.encryptSensitiveFields(user);
    console.log('用户数据更新前加密完成');
  }

  // 查询后解密敏感数据
  afterLoad(entity) {
    this.decryptSensitiveFields(entity);
    console.log('用户数据查询后解密完成');
  }

  // 加密敏感字段
  encryptSensitiveFields(user) {
    if (!user) return;

    // 方法1: 使用自定义装饰器标记的字段
    const sensitiveFields = User.sensitiveFields || [];
    
    // 方法2: 硬编码敏感字段（备用方案）
    if (sensitiveFields.length === 0) {
      sensitiveFields.push('password', 'phone', 'secretKey');
    }
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        const originalValue = user[field];
        user[field] = this.sensitiveData.encrypt(user[field]);
        console.log(`字段 ${field} 加密: ${originalValue} -> ${user[field]}`);
      }
    }
  }

  // 解密敏感字段
  decryptSensitiveFields(user) {
    if (!user) return;

    const sensitiveFields = User.sensitiveFields || ['password', 'phone', 'secretKey'];
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        const encryptedValue = user[field];
        user[field] = this.sensitiveData.decrypt(user[field]);
        console.log(`字段 ${field} 解密: ${encryptedValue} -> ${user[field]}`);
      }
    }
  }
}

// 显示实体信息
console.log('实体信息:');
console.log('  表名:', User.tableName);
console.log('  列信息:');
User.columns.forEach(col => {
  console.log(`    - ${col.name}: ${col.type || 'unknown'}${col.length ? `(${col.length})` : ''}${col.primary ? ' (主键)' : ''}${col.unique ? ' (唯一)' : ''}`);
});
console.log('  敏感字段:', User.sensitiveFields);
console.log('');

// 创建 Subscriber 实例
const subscriber = new SensitiveDataSubscriber();

// 模拟用户数据
const user = new User({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123',
  phone: '13800138000',
  secretKey: 'api_secret_key_123',
  createdAt: new Date(),
  updatedAt: new Date()
});

console.log('原始用户数据:');
console.log('  name:', user.name);
console.log('  email:', user.email);
console.log('  password:', user.password);
console.log('  phone:', user.phone);
console.log('  secretKey:', user.secretKey);
console.log('');

// 模拟 beforeInsert 事件
console.log('模拟 beforeInsert 事件...');
const insertEvent = { entity: user };
subscriber.beforeInsert(insertEvent);

console.log('加密后的用户数据:');
console.log('  name:', user.name);
console.log('  email:', user.email);
console.log('  password:', user.password);
console.log('  phone:', user.phone);
console.log('  secretKey:', user.secretKey);
console.log('');

// 模拟 afterLoad 事件
console.log('模拟 afterLoad 事件...');
subscriber.afterLoad(user);

console.log('解密后的用户数据:');
console.log('  name:', user.name);
console.log('  email:', user.email);
console.log('  password:', user.password);
console.log('  phone:', user.phone);
console.log('  secretKey:', user.secretKey);
console.log('');

// 验证数据完整性
const isCorrect = 
  user.password === 'secret123' &&
  user.phone === '13800138000' &&
  user.secretKey === 'api_secret_key_123';

console.log(`数据完整性验证: ${isCorrect ? '✅ 通过' : '❌ 失败'}`);

console.log('\n=== 装饰器结合 Subscriber 的优势 ===');
console.log('1. 类型安全: 使用 TypeScript 装饰器提供编译时类型检查');
console.log('2. 自动标记: 通过 @SensitiveField() 装饰器自动标记敏感字段');
console.log('3. 配置集中: 敏感字段配置集中在实体定义中');
console.log('4. 自动化处理: Subscriber 自动处理加密/解密，无需手动调用');
console.log('5. 生命周期集成: 与 TypeORM 生命周期完美集成');

console.log('\n=== 在真实 TypeORM 项目中的使用 ===');
console.log('在 TypeScript 项目中，你可以这样定义实体：');
console.log(`
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
`);

console.log('然后 Subscriber 会自动处理这些标记了 @SensitiveField() 的字段！'); 