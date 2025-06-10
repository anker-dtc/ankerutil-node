import { 
  TypeORMIntegration, 
  TypeORMIntegrationBuilder, 
  createSensitiveFieldDecorator 
} from '../src/index';

// 模拟TypeORM装饰器（在实际项目中会从typeorm包导入）
function Entity(tableName: string) {
  return function(target: any) {
    target.tableName = tableName;
  };
}

function PrimaryGeneratedColumn() {
  return function(target: any, propertyKey: string) {
    // 装饰器逻辑
  };
}

function Column(options: any = {}) {
  return function(target: any, propertyKey: string) {
    // 装饰器逻辑
  };
}

function CreateDateColumn() {
  return function(target: any, propertyKey: string) {
    // 装饰器逻辑
  };
}

function UpdateDateColumn() {
  return function(target: any, propertyKey: string) {
    // 装饰器逻辑
  };
}

// 创建敏感字段装饰器
const SensitiveField = createSensitiveFieldDecorator();

// 定义实体
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  password!: string;

  @Column({ type: 'varchar', length: 20 })
  @SensitiveField()
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  secretKey!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  @SensitiveField()
  ssn!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  @SensitiveField()
  salary!: number;

  @Column({ type: 'varchar', length: 255 })
  @SensitiveField()
  bankAccount!: string;
}

// 模拟TypeORM DataSource
class MockDataSource {
  private options: any;
  public isInitialized: boolean = false;

  constructor(options: any) {
    this.options = options;
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
    console.log('Mock DataSource 初始化成功');
    console.log('实体:', this.options.entities?.map((e: any) => e.name));
    console.log('Subscribers:', this.options.subscribers?.length || 0);
  }

  async destroy(): Promise<void> {
    this.isInitialized = false;
    console.log('Mock DataSource 已关闭');
  }
}

// 使用示例
async function demonstrateTypeORMIntegration() {
  console.log('=== TypeORM集成使用示例 ===\n');

  // 方法1: 使用构建器模式
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
      serverAddr: process.env.NACOS_SERVER || 'localhost:8848',
      namespace: process.env.NACOS_NAMESPACE || 'public',
      username: process.env.NACOS_USERNAME || 'nacos',
      password: process.env.NACOS_PASSWORD || 'nacos'
    })
    .setEncryptedConfig('ankerutil-encrypted-config', 'DEFAULT_GROUP')
    .setEntities([User, Employee])
    .setSensitiveFields(new Map([
      [User, ['password', 'phone', 'secretKey']],
      [Employee, ['ssn', 'salary', 'bankAccount']]
    ]))
    .setAutoRegisterSensitiveSubscriber(true)
    .build();

  // 设置DataSource工厂函数
  integration.setDataSourceFactory((options) => new MockDataSource(options));

  // 初始化集成
  await integration.initialize();

  // 获取DataSource和敏感数据处理器
  const dataSource = integration.getDataSource();
  const sensitiveData = integration.getSensitiveData();

  console.log('\n=== 功能验证 ===');

  // 测试敏感数据加密/解密
  const testPassword = 'secret123';
  const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(testPassword);
  const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);

  console.log('敏感数据测试:');
  console.log('  原始密码:', testPassword);
  console.log('  加密后:', encrypted.substring(0, 50) + '...');
  console.log('  解密后:', decrypted);
  console.log('  验证结果:', testPassword === decrypted ? '✅ 成功' : '❌ 失败');

  // 测试实体敏感字段
  const user = new User();
  user.name = 'John Doe';
  user.email = 'john@example.com';
  user.password = 'secret123';
  user.phone = '13800138000';
  user.secretKey = 'api_key_123';

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
      user[field] = sensitiveData.aes128Sha256EncryptSensitiveData(user[field]);
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
      user[field] = sensitiveData.aes128Sha256DecryptSensitiveData(user[field]);
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
}

// 运行示例
demonstrateTypeORMIntegration().catch(console.error); 