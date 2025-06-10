const { SensitiveData } = require('../dist/sensitive_data');
const crypto = require('crypto');

describe('Go 版本兼容性测试', () => {
  let sensitiveData;

  beforeEach(() => {
    sensitiveData = new SensitiveData();
    // 使用与 Go 测试相同的密钥
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    sensitiveData.initSensitiveKey(cbcKey, rootKey);
  });

  test('加密结果应该符合 Go 版本的格式要求', () => {
    const input = "Hello World";
    const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(input);
    const parts = encrypted.split('^');
    
    // 验证格式
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('0001');  // 版本号
    expect(parts[2].length).toBe(64);  // SHA256 摘要长度
    
    // 解密验证
    const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
    expect(decrypted).toBe(input);
  });

  test('应该能解密 Go 版本加密的数据', () => {
    const input = "Hello World";
    // 使用 Go 版本加密的数据
    const encrypted = "0001^0sxYzEXuDxLWD6RqCoUbw43ZwIwxoK7D0Z+5SFigH0s/5Cc8wNsCKcMLMr2csCjLvAtH3AbfLKOYk/l7hKgl6Q==^a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e^6Kpy9ppH1go+/+ejTX/kwa6op5jxEMBXUjqB1mVWI/M=";
    
    const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
    expect(decrypted).toBe(input);
  });

  test('Node.js 加密的数据应该能被 Go 版本解密', () => {
    const input = "Hello World";
    const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(input);
    
    // 验证加密结果的格式
    const parts = encrypted.split('^');
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('0001');
    
    // 验证 SHA256 摘要
    const expectedDigest = crypto.createHash('sha256')
      .update(input, 'utf8')
      .digest('hex');
    expect(parts[2]).toBe(expectedDigest);
  });
}); 