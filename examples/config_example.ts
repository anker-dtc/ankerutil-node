import { ConfigManager, NacosConfig } from '../src/index';

async function main() {
  // Nacos配置
  const nacosConfig: NacosConfig = {
    serverAddr: 'localhost:8848',
    namespace: 'public',
    username: 'nacos',
    password: 'nacos'
  };

  // 配置管理器选项
  const configManagerOptions = {
    nacos: nacosConfig,
    encryptedConfigDataId: 'ankerutil-encrypted-config',
    encryptedConfigGroup: 'DEFAULT_GROUP',
    encryptedConfigTenant: 'public'
  };

  // 创建配置管理器
  const configManager = new ConfigManager(configManagerOptions);

  try {
    // 初始化配置管理器
    const initialized = await configManager.initialize();
    if (!initialized) {
      console.error('配置管理器初始化失败');
      return;
    }

    console.log('配置管理器初始化成功');

    // 示例1: 获取包含敏感数据的配置
    const dbConfig = await configManager.getConfig('database-config', 'DEFAULT_GROUP');
    console.log('数据库配置:', dbConfig);
    // 输出: { host: 'localhost', port: 3306, password: 'decrypted_password', username: 'root' }

    // 示例2: 发布包含敏感数据的配置
    const newConfig = {
      database: {
        host: '192.168.1.100',
        port: 5432,
        password: 'my_sensitive_password', // 会自动加密
        username: 'admin'
      },
      redis: {
        host: 'localhost',
        port: 6379,
        password: 'redis_secret_key' // 会自动加密
      }
    };

    const published = await configManager.publishConfig('app-config', 'DEFAULT_GROUP', newConfig);
    console.log('配置发布成功:', published);

    // 示例3: 监听配置变化
    await configManager.listenConfig('app-config', 'DEFAULT_GROUP', (config) => {
      console.log('配置发生变化:', config);
    });

    // 示例4: 直接使用敏感数据加密功能
    const sensitiveData = configManager.getSensitiveData();
    const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData('Hello World');
    const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
    console.log('加密测试:', { encrypted, decrypted });

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    // 关闭连接
    await configManager.close();
  }
}

// 运行示例
main().catch(console.error); 