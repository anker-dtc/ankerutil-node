import { ConfigManager, BatchProcessor } from '../src/index';

async function main() {
  // 1. 初始化配置管理器（只负责从Nacos加载加密配置）
  const configManager = new ConfigManager({
    nacos: {
      serverAddr: 'localhost:8848',
      namespace: 'public',
      username: 'nacos',
      password: 'nacos'
    },
    encryptedConfigDataId: 'ankerutil-encrypted-config',
    encryptedConfigGroup: 'DEFAULT_GROUP'
  });

  await configManager.initialize();
  console.log('配置管理器初始化成功');

  // 2. 创建独立的敏感数据处理器（用于批量操作）
  const sensitiveData = configManager.createSensitiveDataHandler();

  // 3. 创建批量处理器
  const batchProcessor = new BatchProcessor(sensitiveData, {
    batchSize: 1000,        // 每批处理1000条
    concurrency: 4,         // 4个并发
    onProgress: (processed, total) => {
      console.log(`处理进度: ${processed}/${total} (${Math.round(processed/total*100)}%)`);
    }
  });

  // 4. 模拟海量数据
  const largeDataset = Array.from({ length: 10000 }, (_, i) => `sensitive_data_${i}`);
  console.log(`开始处理 ${largeDataset.length} 条数据...`);

  // 5. 批量加密
  console.log('开始批量加密...');
  const startTime = Date.now();
  const encryptedData = await batchProcessor.batchEncrypt(largeDataset);
  const encryptTime = Date.now() - startTime;
  console.log(`批量加密完成，耗时: ${encryptTime}ms`);

  // 6. 批量解密
  console.log('开始批量解密...');
  const decryptStartTime = Date.now();
  const decryptedData = await batchProcessor.batchDecrypt(encryptedData);
  const decryptTime = Date.now() - decryptStartTime;
  console.log(`批量解密完成，耗时: ${decryptTime}ms`);

  // 7. 验证结果
  const isCorrect = largeDataset.every((item, index) => item === decryptedData[index]);
  console.log(`数据完整性验证: ${isCorrect ? '通过' : '失败'}`);

  // 8. 流式处理示例（适用于超大数据集）
  console.log('\n开始流式处理示例...');
  const streamData = Array.from({ length: 50000 }, (_, i) => `stream_data_${i}`);
  
  let streamProcessed = 0;
  for await (const batch of batchProcessor.streamEncrypt(streamData)) {
    streamProcessed += batch.length;
    console.log(`流式处理进度: ${streamProcessed}/${streamData.length}`);
  }

  // 9. 对象批量处理示例
  console.log('\n开始对象批量处理...');
  const userData = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `user_${i}`,
    email: `user${i}@example.com`,
    password: `password_${i}`,        // 敏感字段
    phone: `1380000${i.toString().padStart(4, '0')}`,
    secretKey: `secret_${i}`          // 敏感字段
  }));

  const encryptedUsers = await batchProcessor.batchEncryptObjects(userData, ['password', 'secretKey']);
  console.log('用户数据加密完成');

  const decryptedUsers = await batchProcessor.batchDecryptObjects(encryptedUsers, ['password', 'secretKey']);
  console.log('用户数据解密完成');

  // 验证对象处理结果
  const userCorrect = userData.every((user, index) => 
    user.password === decryptedUsers[index].password &&
    user.secretKey === decryptedUsers[index].secretKey
  );
  console.log(`对象数据完整性验证: ${userCorrect ? '通过' : '失败'}`);

  // 10. 关闭连接
  await configManager.close();
  console.log('处理完成，连接已关闭');
}

// 运行示例
main().catch(console.error); 