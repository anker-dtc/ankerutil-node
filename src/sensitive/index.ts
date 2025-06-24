import * as crypto from 'crypto';

interface RootKey {
  [version: string]: string;
}

interface Constants {
  SENSITIVE_DATA_KEY_LEN: number;
  SENSITIVE_ROOT_KEY_LEN: number;
  SENSITIVE_ROOT_KEY_VERSION_LEN: number;
  DEFAULT_ROOT_KEY_VERSION: string;
  NEW_CIPHERTEXT_SPLIT_LEN: number;
  OLD_CIPHERTEXT_SPLIT_LEN: number;
  AES_BLOCK_SIZE: number;
}

export class SensitiveData {
  private sensitiveDataKey: string | null;
  private sensitiveRootKey: RootKey;
  private sensitiveRootKeyVersion: string | null;
  private sensitiveRootKeyValue: string | null;

  private readonly CONSTANTS: Constants = {
    SENSITIVE_DATA_KEY_LEN: 64,
    SENSITIVE_ROOT_KEY_LEN: 32,
    SENSITIVE_ROOT_KEY_VERSION_LEN: 4,
    DEFAULT_ROOT_KEY_VERSION: '0001',
    NEW_CIPHERTEXT_SPLIT_LEN: 4,
    OLD_CIPHERTEXT_SPLIT_LEN: 2,
    AES_BLOCK_SIZE: 16
  };

  constructor() {
    this.sensitiveDataKey = null;
    this.sensitiveRootKey = {};
    this.sensitiveRootKeyVersion = null;
    this.sensitiveRootKeyValue = null;
  }

  initSensitiveKey(cbcKey: string, rootKey: RootKey): void {
    // 验证 cbcKey
    if (cbcKey.length !== this.CONSTANTS.SENSITIVE_DATA_KEY_LEN) {
      throw new Error('InitSensitiveKey cbcKey len invalid');
    }

    const keyBytes = Buffer.from(cbcKey, 'hex');
    if (keyBytes.length !== 2 * this.CONSTANTS.AES_BLOCK_SIZE) {
      throw new Error('InitSensitiveKey cbcKey BlockSize error');
    }

    this.sensitiveDataKey = cbcKey;

    // 验证 rootKey
    if (!rootKey || Object.keys(rootKey).length === 0) {
      throw new Error('InitSensitiveKey rootKey not empty');
    }

    for (const [version, key] of Object.entries(rootKey)) {
      if (version.length !== this.CONSTANTS.SENSITIVE_ROOT_KEY_VERSION_LEN) {
        throw new Error('InitSensitiveKey rootKeyVersion len invalid');
      }
      if (key.length !== this.CONSTANTS.SENSITIVE_ROOT_KEY_LEN) {
        throw new Error('InitSensitiveKey rootKey len invalid');
      }

      const keyBytes = Buffer.from(key, 'hex');
      if (keyBytes.length !== this.CONSTANTS.AES_BLOCK_SIZE) {
        throw new Error('InitSensitiveKey rootKey BlockSize error');
      }

      this.sensitiveRootKey[version] = key;
    }

    // 设置最新版本的 root_key
    const versions = Object.keys(this.sensitiveRootKey).sort();
    if (versions.length > 0) {
      this.sensitiveRootKeyVersion = versions[versions.length - 1];
      this.sensitiveRootKeyValue = this.sensitiveRootKey[this.sensitiveRootKeyVersion];
    }
  }

  private aesCbcEncrypt(plaintext: string, key: string): string {
    if (!plaintext) return '';
    
    try {
      const keyBytes = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(this.CONSTANTS.AES_BLOCK_SIZE);
      
      const cipher = crypto.createCipheriv('aes-128-cbc', keyBytes, iv);
      cipher.setAutoPadding(true);  // 使用 PKCS7 填充

      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(plaintext, 'utf8')),
        cipher.final()
      ]);
      
      return Buffer.concat([iv, encrypted]).toString('base64');
    } catch (error) {
      throw new Error(`AES CBC Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private aesCbcDecrypt(ciphertext: string, key: string): string {
    if (!ciphertext) return '';
    
    try {
      const keyBytes = Buffer.from(key, 'hex');
      const data = Buffer.from(ciphertext, 'base64');
      
      const iv = data.subarray(0, this.CONSTANTS.AES_BLOCK_SIZE);
      const encryptedData = data.subarray(this.CONSTANTS.AES_BLOCK_SIZE);
      
      const decipher = crypto.createDecipheriv('aes-128-cbc', keyBytes, iv);
      decipher.setAutoPadding(true);  // 使用 PKCS7 填充
      
      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      return '';  // 解密失败时返回空字符串
    }
  }

  private sha256(text: string): string {
    const utf8Text = String(text);
    return crypto.createHash('sha256')
      .update(utf8Text, 'utf8')
      .digest('hex');
  }

  private generateAesKey(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  aes128Sha256EncryptSensitiveData(plaintext: string): string {
    if (!plaintext) return '';

    try {
      const utf8Plaintext = String(plaintext);
      const digest = this.sha256(utf8Plaintext);
      const dataKey = this.generateAesKey();
      const secretData = this.aesCbcEncrypt(utf8Plaintext, dataKey);
      const envelopeKey = this.aesCbcEncrypt(dataKey, this.sensitiveRootKeyValue!);

      return `${this.sensitiveRootKeyVersion}^${envelopeKey}^${digest}^${secretData}`;
    } catch (error) {
      return '';  // 加密失败时返回空字符串
    }
  }

  aes128Sha256DecryptSensitiveData(ciphertext: string): string {
    if (!ciphertext) return '';

    try {
      const parts = ciphertext.split('^');

      // 处理新版加密数据
      if (parts.length === this.CONSTANTS.NEW_CIPHERTEXT_SPLIT_LEN) {
        const [rootKeyVersion, envelopeKey, digest, secretData] = parts;

        if (!rootKeyVersion || !envelopeKey || !digest || !secretData) {
          return '';
        }

        const rootKey = this.sensitiveRootKey[rootKeyVersion];
        if (!rootKey) return '';  // 如果找不到对应版本的root_key，返回空字符串

        const dataKey = this.aesCbcDecrypt(envelopeKey, rootKey);
        if (!dataKey) return '';

        const plaintext = this.aesCbcDecrypt(secretData, dataKey);
        if (!plaintext) return '';

        if (this.sha256(plaintext) !== digest) return '';

        return plaintext;
      } else {
        // 处理旧版加密数据
        return this.decryptSensitiveDataByDataKey(ciphertext);
      }
    } catch (error) {
      return '';  // 解密失败时返回空字符串
    }
  }

  private decryptSensitiveDataByDataKey(ciphertext: string): string {
    try {
      const parts = ciphertext.split('^');
      if (parts.length !== this.CONSTANTS.OLD_CIPHERTEXT_SPLIT_LEN) {
        return '';
      }

      const [rootKeyVersion, secretData] = parts;
      if (rootKeyVersion !== this.CONSTANTS.DEFAULT_ROOT_KEY_VERSION || !secretData) {
        return '';
      }

      return this.aesCbcDecrypt(secretData, this.sensitiveDataKey!);
    } catch (error) {
      return '';  // 解密失败时返回空字符串
    }
  }
}

// 兼容性导出
export { SensitiveData as EncryptionUtil };
