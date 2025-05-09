const { SensitiveData } = require('../dist/sensitive');

// 测试数据
const testData = {
  cbcKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  rootKey: {
    '0001': '0123456789abcdef0123456789abcdef'
  },
  plaintext: 'test123'
};

// 创建 SensitiveData 实例
const sensitiveData = new SensitiveData();

// 初始化密钥
try {
  sensitiveData.initSensitiveKey(testData.cbcKey, testData.rootKey);
  console.log('初始化密钥成功');
} catch (error) {
  console.error('初始化密钥失败:', error.message);
  process.exit(1);
}

// 测试加密
try {
  const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(testData.plaintext);
  console.log('加密结果:', encrypted);
  
  // 测试解密
  const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
  console.log('解密结果:', decrypted);
  
  // 验证结果
  if (decrypted === testData.plaintext) {
    console.log('测试通过: 加密解密结果匹配');
  } else {
    console.error('测试失败: 加密解密结果不匹配');
    process.exit(1);
  }
} catch (error) {
  console.error('测试失败:', error.message);
  process.exit(1);
} 