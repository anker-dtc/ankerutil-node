/**
 * DTC 系统敏感配置示例
 * 使用真实的 DTC 配置格式和参数
 */

const { EnhancedNacosConfig, createAndInitEnhancedNacosConfig } = require('../dist/index.js');

// DTC 系统配置示例
async function dtcConfigExample() {
  console.log('=== DTC 系统敏感配置示例 ===');

  try {
    // 创建使用 DTC 配置的增强版 Nacos 客户端
    const dtcNacosClient = new EnhancedNacosConfig({
      // Nacos 服务器配置
      serverAddr: '127.0.0.1:8848',
      namespace: 'dtc-production',
      requestTimeout: 6000,
      
      // DTC 系统的敏感配置管理配置
      secretManager: {
        Key: "118c02b71e211049304bd70a0c971d77",
        Domain: "https://vsaas-api-ci.eufylife.com",
        Name: "DTC"
      },
      
      // 启用敏感配置处理
      enableSecretProcessing: true,
      // 失败时返回原始配置（生产环境建议）
      secretFailureStrategy: 'return_original'
    });

    // 初始化客户端
    await dtcNacosClient.init();
    console.log('✅ DTC Nacos 客户端初始化成功');
    console.log('配置信息:');
    console.log('- 系统名称: DTC');
    console.log('- 密钥: 118c02b71e211049304bd70a0c971d77');
    console.log('- 服务域名: https://vsaas-api-ci.eufylife.com');

    // 模拟 DTC 系统的配置内容
    const dtcConfigContent = {
      "SecretManage": {
        "Key": "118c02b71e211049304bd70a0c971d77",
        "Domain": "https://vsaas-api-ci.eufylife.com",
        "Name": "DTC"
      },
      "database": {
        "host": "dtc-db.internal",
        "port": 5432,
        "database": "dtc_production",
        "username": "dtc_user",
        "password": "{{encrypted_db_password_v1}}"
      },
      "redis": {
        "host": "dtc-redis.internal",
        "port": 6379,
        "password": "{{encrypted_redis_password_v1}}"
      },
      "jwt": {
        "secret": "{{encrypted_jwt_secret_v1}}",
        "expiresIn": "24h",
        "issuer": "DTC-System"
      },
      "api": {
        "vsaas": {
          "endpoint": "https://vsaas-api-ci.eufylife.com",
          "apiKey": "{{encrypted_vsaas_api_key_v1}}",
          "timeout": 30000
        }
      },
      "encryption": {
        "aes": {
          "key": "{{encrypted_aes_master_key_v1}}"
        }
      }
    };

    console.log('\n📋 模拟配置内容:');
    console.log(JSON.stringify(dtcConfigContent, null, 2));

    // 测试配置处理
    console.log('\n🔄 开始处理敏感配置...');
    
    try {
      // 获取秘密管理器进行手动测试
      const secretManager = dtcNacosClient.getSecretManager();
      if (secretManager) {
        const processedConfig = await secretManager.processSecretConfig(
          JSON.stringify(dtcConfigContent, null, 2)
        );
        
        console.log('✅ 配置处理成功');
        console.log('处理后的配置:');
        console.log(processedConfig);
      }
    } catch (error) {
      console.log('⚠️  配置处理失败（这是预期的，因为可能无法连接到服务）:');
      console.log('错误类型:', error.name);
      console.log('错误信息:', error.message);
      
      // 显示会发送到服务的详细信息
      console.log('\n📡 如果服务可用，会发送的请求详情:');
      console.log('- URL: https://vsaas-api-ci.eufylife.com/secretmanage/decrypt/config');
      console.log('- Method: POST');
      console.log('- Content-Type: application/json');
      
      // 生成实际的签名示例
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `SecretManageAnker+${timestamp}+DTC+118c02b71e211049304bd70a0c971d77`;
      console.log('- 签名字符串模板:', message);
      
      const crypto = require('crypto');
      const signature = crypto.createHmac('sha256', '118c02b71e211049304bd70a0c971d77')
        .update(message)
        .digest('hex');
      console.log('- 生成的签名:', signature);
      
      console.log('\n请求体示例:');
      console.log(JSON.stringify({
        "auth": {
          "system_name": "DTC",
          "timestamp": timestamp,
          "signature": signature
        },
        "config": JSON.stringify(dtcConfigContent, null, 2)
      }, null, 2));
    }

    // 演示配置监听
    console.log('\n👂 设置配置监听...');
    try {
      await dtcNacosClient.subscribe({
        dataId: 'dtc-app-config',
        group: 'DTC_GROUP',
        onChanged: (content, isDecrypted) => {
          console.log('\n🔔 配置变更通知:');
          console.log('- 时间:', new Date().toISOString());
          console.log('- 是否解密:', isDecrypted ? '是' : '否');
          console.log('- 内容预览:', content.substring(0, 100) + '...');
        }
      });
      console.log('✅ 配置监听已启动');
    } catch (error) {
      console.log('⚠️  配置监听设置失败:', error.message);
    }

    // 演示动态配置管理
    console.log('\n⚙️  动态配置管理演示:');
    console.log('- 当前敏感配置处理状态:', dtcNacosClient.isSecretProcessingEnabled() ? '启用' : '禁用');
    
    // 临时禁用敏感配置处理
    dtcNacosClient.setSecretProcessingEnabled(false);
    console.log('- 已临时禁用敏感配置处理');
    
    // 重新启用
    dtcNacosClient.setSecretProcessingEnabled(true);
    console.log('- 已重新启用敏感配置处理');

    // 清理
    setTimeout(async () => {
      await dtcNacosClient.close();
      console.log('\n🔚 DTC Nacos 客户端已关闭');
    }, 3000);

  } catch (error) {
    console.error('❌ DTC 配置示例失败:', error.message);
    console.error('错误详情:', error.stack);
  }
}

// Express.js 风格的 DTC 服务示例
async function dtcExpressService() {
  console.log('\n=== DTC Express.js 服务示例 ===');

  try {
    // 创建 DTC 专用的增强版客户端
    const dtcClient = await createAndInitEnhancedNacosConfig({
      serverAddr: process.env.NACOS_SERVER || '127.0.0.1:8848',
      namespace: process.env.NACOS_NAMESPACE || 'dtc-production',
      secretManager: {
        Key: "118c02b71e211049304bd70a0c971d77",
        Domain: "https://vsaas-api-ci.eufylife.com",
        Name: "DTC"
      },
      enableSecretProcessing: true,
      secretFailureStrategy: 'return_original'
    });

    console.log('✅ DTC Express 服务初始化成功');

    // 模拟加载不同的配置文件
    const configFiles = [
      'dtc-database-config',
      'dtc-redis-config', 
      'dtc-api-config',
      'dtc-security-config'
    ];

    const configs = {};

    for (const configFile of configFiles) {
      try {
        const config = await dtcClient.getJsonConfig(configFile, 'DTC_GROUP');
        configs[configFile] = config || {};
        console.log(`✅ 加载配置 ${configFile}: ${config ? '成功' : '使用默认'}`);
      } catch (error) {
        console.log(`⚠️  加载配置 ${configFile} 失败:`, error.message);
        configs[configFile] = {};
      }
    }

    // 设置配置监听
    for (const configFile of configFiles) {
      await dtcClient.subscribe({
        dataId: configFile,
        group: 'DTC_GROUP',
        onChanged: (content, isDecrypted) => {
          try {
            configs[configFile] = JSON.parse(content);
            console.log(`🔄 配置 ${configFile} 已更新 ${isDecrypted ? '(解密)' : '(明文)'}`);
          } catch (error) {
            console.error(`❌ 配置 ${configFile} 解析失败:`, error.message);
          }
        }
      });
    }

    console.log('👂 所有配置监听已设置完成');

    // 模拟 Express.js 服务
    const expressSimulation = {
      getHealth: () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        system: 'DTC',
        secretProcessing: dtcClient.isSecretProcessingEnabled()
      }),
      
      getConfigs: () => ({
        timestamp: new Date().toISOString(),
        configs: Object.keys(configs).reduce((acc, key) => {
          acc[key] = configs[key] ? 'loaded' : 'empty';
          return acc;
        }, {})
      }),
      
      getSecretStatus: () => ({
        secretManagerEnabled: dtcClient.isSecretProcessingEnabled(),
        secretManager: dtcClient.getSecretManager() ? 'configured' : 'not configured'
      })
    };

    console.log('\n🌐 模拟 Express.js 路由响应:');
    console.log('GET /health:', JSON.stringify(expressSimulation.getHealth(), null, 2));
    console.log('GET /configs:', JSON.stringify(expressSimulation.getConfigs(), null, 2));
    console.log('GET /secret-status:', JSON.stringify(expressSimulation.getSecretStatus(), null, 2));

    // 清理
    setTimeout(async () => {
      await dtcClient.close();
      console.log('\n🔚 DTC Express 服务已关闭');
    }, 2000);

  } catch (error) {
    console.error('❌ DTC Express 服务示例失败:', error.message);
  }
}

// 运行所有 DTC 示例
async function runDtcExamples() {
  console.log('🚀 开始运行 DTC 系统配置示例...\n');
  
  await dtcConfigExample();
  await dtcExpressService();
  
  console.log('\n✨ 所有 DTC 示例完成');
  console.log('\n📝 总结:');
  console.log('1. ✅ 支持你提供的 DTC 配置格式');
  console.log('2. ✅ 正确的签名算法和API调用格式');
  console.log('3. ✅ 完整的Express.js/NestJS集成支持');
  console.log('4. ✅ 动态配置管理和监听功能');
  console.log('5. ⚠️  实际使用需要确保 https://vsaas-api-ci.eufylife.com 可访问');
}

// 导出函数
module.exports = {
  dtcConfigExample,
  dtcExpressService,
  runDtcExamples
};

// 如果直接运行此文件
if (require.main === module) {
  runDtcExamples().catch(console.error);
}