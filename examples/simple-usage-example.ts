import { SensitiveData } from '../dist/index';

console.log('=== ankerutil-node 核心功能演示 ===\n');

// ========== 1. 基础加密解密 ==========
console.log('1. 基础加密解密示例');

const sensitiveData = new SensitiveData();
const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const rootKey = {
  "0001": "0123456789abcdef0123456789abcdef"
};

// 初始化加密器
sensitiveData.initSensitiveKey(cbcKey, rootKey);

// 测试数据
const testData = [
  "这是敏感数据",
  "user@example.com",
  "13800138000",
  "北京市朝阳区某某街道123号"
];

console.log('原始数据:');
testData.forEach((text, index) => {
  console.log(`  ${index + 1}. ${text}`);
});

console.log('\n加密结果:');
const encryptedResults = testData.map(text => 
  sensitiveData.aes128Sha256EncryptSensitiveData(text)
);
encryptedResults.forEach((encrypted, index) => {
  console.log(`  ${index + 1}. ${encrypted}`);
});

console.log('\n解密结果:');
const decryptedResults = encryptedResults.map(encrypted => 
  sensitiveData.aes128Sha256DecryptSensitiveData(encrypted)
);
decryptedResults.forEach((decrypted, index) => {
  console.log(`  ${index + 1}. ${decrypted}`);
});

// 验证结果
console.log('\n验证结果:');
const allValid = testData.every((original, index) => original === decryptedResults[index]);
console.log(`所有数据验证: ${allValid ? '✅ 成功' : '❌ 失败'}`);

console.log('\n=== 使用说明 ===');
console.log('1. 安装: npm install ankerutil-node');
console.log('2. 导入: import { SensitiveData } from "ankerutil-node"');
console.log('3. 初始化: new SensitiveData().initSensitiveKey(cbcKey, rootKey)');
console.log('4. 加密: sensitiveData.aes128Sha256EncryptSensitiveData(text)');
console.log('5. 解密: sensitiveData.aes128Sha256DecryptSensitiveData(encryptedText)');
console.log('\n如需TypeORM装饰器功能，请参考README.md中的完整示例。'); 