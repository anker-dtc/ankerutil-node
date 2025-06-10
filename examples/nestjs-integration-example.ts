import { SensitiveData } from '../dist/sensitive_data';

// 敏感数据服务类
class SensitiveDataService {
  private sensitiveData: SensitiveData;

  constructor() {
    this.sensitiveData = new SensitiveData();
    // 初始化加密密钥
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    this.sensitiveData.initSensitiveKey(cbcKey, rootKey);
  }

  encrypt(text: string): string {
    return this.sensitiveData.aes128Sha256EncryptSensitiveData(text);
  }

  decrypt(encryptedText: string): string {
    return this.sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText);
  }
}

// 使用示例
async function example() {
  console.log('=== ankerutil-node SDK Node.js 22 兼容性测试 ===\n');
  
  const service = new SensitiveDataService();
  
  // 测试1: 基本加密解密
  console.log('测试1: 基本加密解密');
  const originalText = "Hello Node.js 22 with ankerutil-node!";
  console.log('原始文本:', originalText);
  
  const encrypted = service.encrypt(originalText);
  console.log('加密后:', encrypted);
  
  const decrypted = service.decrypt(encrypted);
  console.log('解密后:', decrypted);
  
  console.log('验证结果:', originalText === decrypted ? '✅ 成功' : '❌ 失败');
  console.log('');
  
  // 测试2: 中文文本
  console.log('测试2: 中文文本');
  const chineseText = "这是中文测试文本";
  console.log('原始文本:', chineseText);
  
  const chineseEncrypted = service.encrypt(chineseText);
  console.log('加密后:', chineseEncrypted);
  
  const chineseDecrypted = service.decrypt(chineseEncrypted);
  console.log('解密后:', chineseDecrypted);
  
  console.log('验证结果:', chineseText === chineseDecrypted ? '✅ 成功' : '❌ 失败');
  console.log('');
  
  // 测试3: JSON字符串
  console.log('测试3: JSON字符串');
  const jsonText = '{"name": "张三", "age": 25, "city": "北京"}';
  console.log('原始文本:', jsonText);
  
  const jsonEncrypted = service.encrypt(jsonText);
  console.log('加密后:', jsonEncrypted);
  
  const jsonDecrypted = service.decrypt(jsonEncrypted);
  console.log('解密后:', jsonDecrypted);
  
  console.log('验证结果:', jsonText === jsonDecrypted ? '✅ 成功' : '❌ 失败');
  console.log('');
  
  // 测试4: 特殊字符
  console.log('测试4: 特殊字符');
  const specialText = "特殊字符: !@#$%^&*()_+-=[]{}|;':\",./<>?";
  console.log('原始文本:', specialText);
  
  const specialEncrypted = service.encrypt(specialText);
  console.log('加密后:', specialEncrypted);
  
  const specialDecrypted = service.decrypt(specialEncrypted);
  console.log('解密后:', specialDecrypted);
  
  console.log('验证结果:', specialText === specialDecrypted ? '✅ 成功' : '❌ 失败');
  console.log('');
  
  console.log('=== 所有测试完成 ===');
}

// 如果直接运行此文件
if (require.main === module) {
  example().catch(console.error);
}

export { SensitiveDataService }; 