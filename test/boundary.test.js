const { expect } = require('chai');
const { SensitiveData } = require('../lib/sensitive_data');

describe('敏感数据加密边界情况测试', () => {
  let sensitiveData;
  
  // 统一的测试密钥
  const cbcKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const rootKey = {
    '0001': '0123456789abcdef0123456789abcdef'
  };

  beforeEach(() => {
    sensitiveData = new SensitiveData();
    sensitiveData.initSensitiveKey(cbcKey, rootKey);
  });

  describe('空值处理', () => {
    it('应该正确处理空字符串', () => {
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData('');
      expect(encrypted).to.equal('');

      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData('');
      expect(decrypted).to.equal('');
    });

    it('应该正确处理 null 值', () => {
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(null);
      expect(encrypted).to.equal('');

      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(null);
      expect(decrypted).to.equal('');
    });

    it('应该正确处理 undefined 值', () => {
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(undefined);
      expect(encrypted).to.equal('');

      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(undefined);
      expect(decrypted).to.equal('');
    });
  });

  describe('非法密文格式处理', () => {
    const invalidCiphertexts = [
      'invalid',
      'invalid^text',
      '0001^invalid^text',
      '0001^invalid^text^more^parts',
      '0002^valid^text^parts',  // 未知版本号
      null,
      undefined,
      '',
      '^^^^^',
      '0001^^^^',
      '0001^notBase64^notHash^notBase64'
    ];

    invalidCiphertexts.forEach((invalidText) => {
      it(`应该安全处理非法密文: ${invalidText}`, () => {
        const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(invalidText);
        expect(decrypted).to.equal('');
      });
    });
  });

  describe('特殊字符处理', () => {
    const specialCases = [
      '\n',           // 换行符
      '\t',           // 制表符
      '\r\n',         // Windows 换行
      ' '.repeat(100), // 大量空格
      '^\n^^\t^^',    // 分隔符混合特殊字符
      '🎉💕',         // Emoji
      '\\0',          // 空字符
      String.fromCharCode(0), // NULL 字符
      '\\u0000',      // Unicode NULL
      '\x00',         // 十六进制 NULL
    ];

    specialCases.forEach((specialCase) => {
      it(`应该正确处理特殊字符: ${specialCase.replace(/\s/g, '⎵')}`, () => {
        const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(specialCase);
        const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
        expect(decrypted).to.equal(specialCase);
      });
    });
  });

  describe('长度边界测试', () => {
    it('应该处理超长字符串', () => {
      const longText = 'a'.repeat(1024 * 1024); // 1MB 的数据
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(longText);
      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
      expect(decrypted).to.equal(longText);
    });

    it('应该处理单字符字符串', () => {
      const singleChar = 'x';
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(singleChar);
      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
      expect(decrypted).to.equal(singleChar);
    });
  });

  describe('编码测试', () => {
    const encodingCases = [
      '这是中文',
      'これは日本語です',
      'هذا نص عربي',
      'Это русский текст',
      '🎉 Esta é uma string com emoji 🎊',
      Buffer.from('二进制数据').toString('base64'),
      'Mixed ASCII and 中文 and 日本語',
      'Unicode: \u0000\u0001\u0002\u0003',
    ];

    encodingCases.forEach((testCase) => {
      it(`应该正确处理不同编码: ${testCase}`, () => {
        const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData(testCase);
        const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
        expect(decrypted).to.equal(testCase);
      });
    });
  });

  describe('密钥版本测试', () => {
    it('应该拒绝未知版本的密文', () => {
      // 使用正确的格式但错误的版本号
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData('test')
        .replace('0001', '9999');
      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(encrypted);
      expect(decrypted).to.equal('');
    });

    it('应该验证密文格式', () => {
      const encrypted = sensitiveData.aes128Sha256EncryptSensitiveData('test');
      const parts = encrypted.split('^');
      
      expect(parts).to.have.lengthOf(4);
      expect(parts[0]).to.equal('0001');
      expect(parts[1]).to.match(/^[A-Za-z0-9+/]+=*$/);  // Base64
      expect(parts[2]).to.match(/^[a-f0-9]{64}$/);      // SHA256
      expect(parts[3]).to.match(/^[A-Za-z0-9+/]+=*$/);  // Base64
    });
  });

  describe('互操作性测试', () => {
    it('应该能解密 Ruby 生成的密文', () => {
      // Ruby 生成的测试密文
      const rubyCiphertext = '0001^7BhirFAgANDBvc59xbE0EgpEzFjb+ma9ZWOzw26HiHXoSYPVzFOwTXiYDLyNrhHcygzCK7Df2PagNcKT3kMwSA==^dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f^Tsi05dgo+SAgubusYR9kAsMQO0zM6jMOtbRHdJ6xSzE=';
      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(rubyCiphertext);
      expect(decrypted).to.equal('Hello, World!');
    });

    it('应该能解密 Go 生成的密文', () => {
      // Go 生成的测试密文
      const goCiphertext = '0001^wKOCCRx4+rg2SEdxXXxXUvppZGv8v7cfCn05fK+IofGM73bHwEvZG235ocHfsA64XhUnIzgQqLWRkmmr3YfKfw==^dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f^x1QVsjF9cL09/Fog3Jnbth0+SJgZ87AaAqSdItkt13M=';
      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(goCiphertext);
      expect(decrypted).to.equal('Hello, World!');
    });
  });
}); 