/**
 * 增强版 Nacos 配置读取示例
 * 展示如何使用敏感配置解密功能
 */

const { 
  EnhancedNacosConfig, 
  createAndInitEnhancedNacosConfig,
  SecretManager,
  createSecretManager 
} = require('ankerutil-node');

// 基础增强版 Nacos 使用示例
async function enhancedBasicExample() {
  try {
    console.log('=== 增强版 Nacos 基础示例 ===');

    // 创建增强版 Nacos 客户端
    const enhancedNacosConfig = new EnhancedNacosConfig({
      // 基础 Nacos 配置
      serverAddr: '127.0.0.1:8848',
      namespace: 'development',
      requestTimeout: 6000,
      
      // 敏感配置管理配置
      secretManager: {
        Name: 'DTC',
        Key: '118c02b71e211049304bd70a0c971d77',
        Domain: 'https://vsaas-api-ci.eufylife.com'
      },
      
      // 启用敏感配置处理
      enableSecretProcessing: true,
      // 失败时返回原始配置
      secretFailureStrategy: 'return_original'
    });

    // 初始化客户端
    await enhancedNacosConfig.init();
    console.log('增强版 Nacos 客户端初始化成功');

    // 获取配置（如果包含敏感字段会自动解密）
    const appConfig = await enhancedNacosConfig.getConfig('app.properties');
    console.log('应用配置:', appConfig);

    // 获取 JSON 配置（如果包含敏感字段会自动解密）
    const dbConfig = await enhancedNacosConfig.getJsonConfig('database-config.json');
    console.log('数据库配置:', dbConfig);

    // 监听配置变更（自动处理敏感字段）
    await enhancedNacosConfig.subscribe({
      dataId: 'app.properties',
      group: 'DEFAULT_GROUP',
      onChanged: (content, isDecrypted) => {
        console.log('配置变更通知:');
        console.log('- 内容:', content);
        console.log('- 是否已解密:', isDecrypted);
      }
    });

    console.log('配置监听已启动（支持敏感配置解密）');

    // 动态配置管理
    console.log('\n=== 动态配置管理 ===');
    
    // 检查是否启用敏感配置处理
    console.log('敏感配置处理状态:', enhancedNacosConfig.isSecretProcessingEnabled());
    
    // 动态禁用敏感配置处理
    enhancedNacosConfig.setSecretProcessingEnabled(false);
    console.log('已禁用敏感配置处理');
    
    // 重新启用
    enhancedNacosConfig.setSecretProcessingEnabled(true);
    console.log('已重新启用敏感配置处理');

    // 关闭客户端
    setTimeout(async () => {
      await enhancedNacosConfig.close();
      console.log('增强版 Nacos 客户端已关闭');
    }, 5000);

  } catch (error) {
    console.error('增强版示例运行失败:', error.message);
  }
}

// 独立敏感配置管理器示例
async function secretManagerExample() {
  try {
    console.log('\n=== 独立敏感配置管理器示例 ===');

    // 创建独立的敏感配置管理器
    const secretManager = createSecretManager({
      Name: 'DTC',
      Key: '118c02b71e211049304bd70a0c971d77',
      Domain: 'https://vsaas-api-ci.eufylife.com'
    });

    // 模拟不同格式的配置内容
    const configs = [
      // JSON 格式配置
      {
        name: 'JSON配置',
        content: JSON.stringify({
          "SecretManage": {
            "Key": "118c02b71e211049304bd70a0c971d77",
            "Domain": "https://vsaas-api-ci.eufylife.com",
            "Name": "DTC"
          },
          "database": {
            "host": "localhost",
            "port": 3306,
            "username": "admin",
            "password": "{{encrypted_password_12345}}"
          },
          "redis": {
            "host": "localhost",
            "port": 6379,
            "password": "{{encrypted_redis_pass}}"
          }
        }, null, 2)
      },
      
      // YAML 格式配置
      {
        name: 'YAML配置',
        content: `SecretManage.Name: test-system
SecretManage.Key: test-secret-key-12345678
SecretManage.Domain: https://secret-service.example.com

database:
  host: localhost
  port: 3306
  username: admin
  password: "{{encrypted_password_12345}}"

redis:
  host: localhost
  port: 6379
  password: "{{encrypted_redis_pass}}"`
      },
      
      // INI 格式配置
      {
        name: 'INI配置',
        content: `SecretManage.Name=test-system
SecretManage.Key=test-secret-key-12345678
SecretManage.Domain=https://secret-service.example.com

[database]
host=localhost
port=3306
username=admin
password={{encrypted_password_12345}}

[redis]
host=localhost
port=6379
password={{encrypted_redis_pass}}`
      }
    ];

    // 处理不同格式的配置
    for (const config of configs) {
      console.log(`\n处理 ${config.name}:`);
      console.log('原始配置:', config.content.substring(0, 100) + '...');
      
      try {
        const processedContent = await secretManager.processSecretConfig(config.content);
        console.log('处理结果:', processedContent.substring(0, 100) + '...');
        console.log('处理状态: 成功');
      } catch (error) {
        console.log('处理状态: 失败 -', error.message);
      }
    }

  } catch (error) {
    console.error('敏感配置管理器示例失败:', error.message);
  }
}

// Express.js 风格的使用示例
async function expressStyleExample() {
  try {
    console.log('\n=== Express.js 风格示例 ===');

    // 创建增强版客户端
    const enhancedClient = await createAndInitEnhancedNacosConfig({
      serverAddr: '127.0.0.1:8848',
      namespace: 'production',
      secretManager: {
        Name: process.env.SECRET_MANAGE_NAME || 'test-system',
        Key: process.env.SECRET_MANAGE_KEY || 'test-secret-key-12345678',
        Domain: process.env.SECRET_MANAGE_DOMAIN || 'https://secret-service.example.com'
      },
      enableSecretProcessing: true,
      secretFailureStrategy: 'return_original'
    });

    let appConfig = {};
    let dbConfig = {};

    // 加载配置
    try {
      appConfig = await enhancedClient.getJsonConfig('app-config') || {};
      dbConfig = await enhancedClient.getJsonConfig('database-config') || {};
      console.log('配置加载完成（已处理敏感字段）');
    } catch (error) {
      console.warn('配置加载失败，使用默认配置:', error.message);
    }

    // 监听配置变更
    await enhancedClient.subscribe({
      dataId: 'app-config',
      onChanged: (content, isDecrypted) => {
        try {
          appConfig = JSON.parse(content);
          console.log(`应用配置已更新 ${isDecrypted ? '(已解密)' : '(无需解密)'}`);
        } catch (error) {
          console.error('应用配置解析失败:', error);
        }
      }
    });

    await enhancedClient.subscribe({
      dataId: 'database-config',
      onChanged: (content, isDecrypted) => {
        try {
          dbConfig = JSON.parse(content);
          console.log(`数据库配置已更新 ${isDecrypted ? '(已解密)' : '(无需解密)'}`);
        } catch (error) {
          console.error('数据库配置解析失败:', error);
        }
      }
    });

    // 模拟 Express.js 中间件
    const configMiddleware = (req, res, next) => {
      req.config = {
        app: appConfig,
        database: dbConfig
      };
      next();
    };

    // 模拟路由处理
    const getConfigHandler = (req, res) => {
      res.json({
        timestamp: new Date().toISOString(),
        config: req.config,
        secretProcessingEnabled: enhancedClient.isSecretProcessingEnabled()
      });
    };

    console.log('Express.js 风格配置服务已就绪');
    console.log('模拟配置响应:', JSON.stringify({
      app: appConfig,
      database: dbConfig
    }, null, 2));

    // 清理
    setTimeout(async () => {
      await enhancedClient.close();
      console.log('Express 风格示例完成');
    }, 3000);

  } catch (error) {
    console.error('Express 风格示例失败:', error.message);
  }
}

// 错误处理和恢复示例
async function errorHandlingExample() {
  try {
    console.log('\n=== 错误处理和恢复示例 ===');

    // 创建配置了错误策略的客户端
    const robustClient = new EnhancedNacosConfig({
      serverAddr: '127.0.0.1:8848',
      namespace: 'test',
      secretManager: {
        Name: 'test-system',
        Key: 'invalid-key', // 故意使用无效密钥
        Domain: 'https://invalid-domain.com' // 故意使用无效域名
      },
      enableSecretProcessing: true,
      secretFailureStrategy: 'return_original' // 失败时返回原始配置
    });

    await robustClient.init();

    // 测试配置获取（应该会优雅降级）
    const config = await robustClient.getConfig('test-config');
    console.log('配置获取结果（优雅降级）:', config);

    // 切换到抛错策略
    robustClient.setSecretFailureStrategy('throw_error');
    console.log('已切换到抛错策略');

    try {
      await robustClient.getConfig('test-config');
    } catch (error) {
      console.log('预期的错误:', error.message);
    }

    // 修复配置
    robustClient.setSecretManager({
      Name: 'test-system',
      Key: 'correct-secret-key',
      Domain: 'https://correct-secret-service.com'
    });
    console.log('已修复敏感配置管理器配置');

    await robustClient.close();

  } catch (error) {
    console.error('错误处理示例失败:', error.message);
  }
}

// 运行所有示例
async function runAllExamples() {
  console.log('开始运行增强版 Nacos 配置示例...\n');
  
  await enhancedBasicExample();
  await secretManagerExample();
  await expressStyleExample();
  await errorHandlingExample();
  
  console.log('\n=== 所有示例完成 ===');
}

// 导出所有示例
module.exports = {
  enhancedBasicExample,
  secretManagerExample,
  expressStyleExample,
  errorHandlingExample,
  runAllExamples
};

// 如果直接运行此文件
if (require.main === module) {
  runAllExamples().catch(console.error);
}