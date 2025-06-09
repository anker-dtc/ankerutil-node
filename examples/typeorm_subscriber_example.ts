import { ConfigManager, SensitiveData } from '../src/index';

// 模拟 TypeORM 接口
interface InsertEvent<T> {
  entity: T;
}

interface UpdateEvent<T> {
  entity: T;
}

interface EntitySubscriberInterface {
  listenTo?(): any;
  beforeInsert?(event: InsertEvent<any>): void;
  beforeUpdate?(event: UpdateEvent<any>): void;
  afterLoad?(entity: any): void;
}

// 用户实体 - 在实际项目中会使用 TypeORM 装饰器
export class User {
  id: number;
  name: string;
  email: string;
  password: string;        // 敏感字段
  phone: string;           // 敏感字段
  secretKey: string;       // 敏感字段
  createdAt: Date;
  updatedAt: Date;

  // 在实际 TypeORM 项目中的装饰器用法示例：
  /*
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
  */

  // 获取表名
  static getTableName(): string {
    return 'users';
  }

  // 获取所有列信息
  static getColumns(): any[] {
    return [
      { name: 'id', type: 'int', primary: true, generated: true },
      { name: 'name', type: 'varchar', length: 100 },
      { name: 'email', type: 'varchar', length: 255, unique: true },
      { name: 'password', type: 'varchar', length: 255 },
      { name: 'phone', type: 'varchar', length: 20 },
      { name: 'secretKey', type: 'varchar', length: 255 },
      { name: 'createdAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      { name: 'updatedAt', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }
    ];
  }
}

// 敏感数据 Subscriber
export class SensitiveDataSubscriber implements EntitySubscriberInterface {
  private sensitiveData: SensitiveData;
  private isInitialized: boolean = false;

  constructor() {
    this.initializeSensitiveData();
  }

  private async initializeSensitiveData() {
    try {
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
      this.isInitialized = true;
      
      console.log('敏感数据 Subscriber 初始化成功');
    } catch (error) {
      console.error('敏感数据 Subscriber 初始化失败:', error);
    }
  }

  // 监听用户实体
  listenTo() {
    return User;
  }

  // 插入前加密敏感数据
  beforeInsert(event: InsertEvent<User>) {
    if (!this.isInitialized) {
      console.warn('Subscriber 未初始化，跳过加密');
      return;
    }

    const user = event.entity;
    this.encryptSensitiveFields(user);
    console.log('用户数据插入前加密完成');
  }

  // 更新前加密敏感数据
  beforeUpdate(event: UpdateEvent<User>) {
    if (!this.isInitialized) {
      console.warn('Subscriber 未初始化，跳过加密');
      return;
    }

    const user = event.entity;
    this.encryptSensitiveFields(user);
    console.log('用户数据更新前加密完成');
  }

  // 查询后解密敏感数据
  afterLoad(entity: User) {
    if (!this.isInitialized) {
      console.warn('Subscriber 未初始化，跳过解密');
      return;
    }

    this.decryptSensitiveFields(entity);
    console.log('用户数据查询后解密完成');
  }

  // 加密敏感字段
  private encryptSensitiveFields(user: User) {
    if (!user) return;

    const sensitiveFields = ['password', 'phone', 'secretKey'];
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        const originalValue = user[field];
        user[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(user[field]);
        console.log(`字段 ${field} 加密: ${originalValue} -> ${user[field].substring(0, 20)}...`);
      }
    }
  }

  // 解密敏感字段
  private decryptSensitiveFields(user: User) {
    if (!user) return;

    const sensitiveFields = ['password', 'phone', 'secretKey'];
    
    for (const field of sensitiveFields) {
      if (user[field] && typeof user[field] === 'string') {
        const encryptedValue = user[field];
        user[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(user[field]);
        console.log(`字段 ${field} 解密: ${encryptedValue.substring(0, 20)}... -> ${user[field]}`);
      }
    }
  }
}

// 使用示例
async function demonstrateSubscriber() {
  console.log('=== TypeORM Subscriber 结合装饰器使用示例 ===\n');

  // 显示实体信息
  console.log('实体信息:');
  console.log('  表名:', User.getTableName());
  console.log('  列信息:');
  User.getColumns().forEach(col => {
    console.log(`    - ${col.name}: ${col.type}${col.length ? `(${col.length})` : ''}${col.primary ? ' (主键)' : ''}${col.unique ? ' (唯一)' : ''}`);
  });
  console.log('');

  // 创建 Subscriber 实例
  const subscriber = new SensitiveDataSubscriber();

  // 等待初始化完成
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 模拟用户数据
  const user = new User();
  user.name = 'John Doe';
  user.email = 'john@example.com';
  user.password = 'secret123';
  user.phone = '13800138000';
  user.secretKey = 'api_secret_key_123';
  user.createdAt = new Date();
  user.updatedAt = new Date();

  console.log('原始用户数据:');
  console.log('  name:', user.name);
  console.log('  email:', user.email);
  console.log('  password:', user.password);
  console.log('  phone:', user.phone);
  console.log('  secretKey:', user.secretKey);
  console.log('');

  // 模拟 beforeInsert 事件
  console.log('模拟 beforeInsert 事件...');
  const insertEvent = { entity: user } as InsertEvent<User>;
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
}

// 运行示例
demonstrateSubscriber().catch(console.error); 