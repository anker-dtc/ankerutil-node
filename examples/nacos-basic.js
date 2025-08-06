/**
 * Nacos 配置读取基础使用示例
 * 此示例展示如何在 Node.js 项目中使用 ankerutil-node 的 Nacos 功能
 */

const { NacosConfig, createAndInitNacosConfig } = require('ankerutil-node');

// 基础使用示例
async function basicExample() {
  try {
    console.log('=== 基础 Nacos 配置读取示例 ===');

    // 创建配置客户端
    const nacosConfig = new NacosConfig({
      serverAddr: '127.0.0.1:8848',
      namespace: 'development',
      requestTimeout: 6000,
    });

    // 初始化客户端
    await nacosConfig.init();
    console.log('Nacos 客户端初始化成功');

    // 获取配置
    const appName = await nacosConfig.getConfig('app.name');
    console.log('应用名称:', appName);

    // 获取 JSON 配置
    const dbConfig = await nacosConfig.getJsonConfig('database.json');
    console.log('数据库配置:', dbConfig);

    // 监听配置变更
    await nacosConfig.subscribe({
      dataId: 'app.name',
      group: 'DEFAULT_GROUP',
      onChanged: (content) => {
        console.log('配置变更通知:', content);
      }
    });

    console.log('配置监听已启动');

    // 关闭客户端
    setTimeout(async () => {
      await nacosConfig.close();
      console.log('Nacos 客户端已关闭');
    }, 5000);

  } catch (error) {
    console.error('示例运行失败:', error.message);
  }
}

// Express.js 简单示例
async function expressExample() {
  try {
    console.log('\n=== Express.js 示例 ===');

    // 使用工厂函数创建客户端
    const nacosClient = await createAndInitNacosConfig({
      serverAddr: '127.0.0.1:8848',
      namespace: 'production'
    });

    let appConfig = {};

    // 加载配置
    appConfig = await nacosClient.getJsonConfig('app-config') || {};
    console.log('应用配置加载完成:', Object.keys(appConfig));

    // 监听配置变更
    await nacosClient.subscribe({
      dataId: 'app-config',
      onChanged: (content) => {
        try {
          appConfig = JSON.parse(content);
          console.log('应用配置已更新');
        } catch (error) {
          console.error('配置解析失败:', error);
        }
      }
    });

    // 模拟 Express.js 路由处理
    const getConfig = () => {
      return {
        timestamp: new Date().toISOString(),
        config: appConfig
      };
    };

    console.log('模拟获取配置:', getConfig());

    // 清理
    setTimeout(async () => {
      await nacosClient.close();
      console.log('Express 示例完成');
    }, 3000);

  } catch (error) {
    console.error('Express 示例失败:', error.message);
  }
}

// 运行示例
async function runExamples() {
  await basicExample();
  await expressExample();
}

// 如果直接运行此文件
if (require.main === module) {
  runExamples().catch(console.error);
}

module.exports = {
  basicExample,
  expressExample,
  runExamples
};