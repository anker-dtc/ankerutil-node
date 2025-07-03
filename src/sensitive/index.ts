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

export class Encryption {
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

  init(cbcKey: string, rootKey: RootKey): void {
    // 验证 cbcKey
    if (cbcKey.length !== this.CONSTANTS.SENSITIVE_DATA_KEY_LEN) {
      throw new Error('Init cbcKey len invalid');
    }

    const keyBytes = Buffer.from(cbcKey, 'hex');
    if (keyBytes.length !== 2 * this.CONSTANTS.AES_BLOCK_SIZE) {
      throw new Error('Init cbcKey BlockSize error');
    }

    this.sensitiveDataKey = cbcKey;

    // 验证 rootKey
    if (!rootKey || Object.keys(rootKey).length === 0) {
      throw new Error('Init rootKey not empty');
    }

    for (const [version, key] of Object.entries(rootKey)) {
      if (version.length !== this.CONSTANTS.SENSITIVE_ROOT_KEY_VERSION_LEN) {
        throw new Error('Init rootKeyVersion len invalid');
      }
      if (key.length !== this.CONSTANTS.SENSITIVE_ROOT_KEY_LEN) {
        throw new Error('Init rootKey len invalid');
      }

      const keyBytes = Buffer.from(key, 'hex');
      if (keyBytes.length !== this.CONSTANTS.AES_BLOCK_SIZE) {
        throw new Error('Init rootKey BlockSize error');
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
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }
    
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
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }
    
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
      throw new Error(`AES CBC Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
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

  encrypt(plaintext: string): string {
    if (!plaintext) {
      throw new Error('Plaintext cannot be empty');
    }

    if (!this.sensitiveRootKeyValue || !this.sensitiveRootKeyVersion) {
      throw new Error('Sensitive keys not initialized. Call init() first.');
    }

    try {
      const utf8Plaintext = String(plaintext);
      const digest = this.sha256(utf8Plaintext);
      const dataKey = this.generateAesKey();
      const secretData = this.aesCbcEncrypt(utf8Plaintext, dataKey);
      const envelopeKey = this.aesCbcEncrypt(dataKey, this.sensitiveRootKeyValue);

      return `${this.sensitiveRootKeyVersion}^${envelopeKey}^${digest}^${secretData}`;
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext) {
      throw new Error('Ciphertext cannot be empty');
    }

    try {
      const parts = ciphertext.split('^');

      // 处理新版加密数据
      if (parts.length === this.CONSTANTS.NEW_CIPHERTEXT_SPLIT_LEN) {
        const [rootKeyVersion, envelopeKey, digest, secretData] = parts;

        if (!rootKeyVersion || !envelopeKey || !digest || !secretData) {
          throw new Error('Invalid ciphertext format: missing required parts');
        }

        const rootKey = this.sensitiveRootKey[rootKeyVersion];
        if (!rootKey) {
          throw new Error(`Root key version '${rootKeyVersion}' not found`);
        }

        const dataKey = this.aesCbcDecrypt(envelopeKey, rootKey);
        if (!dataKey) {
          throw new Error('Failed to decrypt envelope key');
        }

        const plaintext = this.aesCbcDecrypt(secretData, dataKey);
        if (!plaintext) {
          throw new Error('Failed to decrypt secret data');
        }

        if (this.sha256(plaintext) !== digest) {
          throw new Error('Data integrity check failed: SHA256 digest mismatch');
        }

        return plaintext;
      } else {
        // 处理旧版加密数据
        return this.decryptSensitiveDataByDataKey(ciphertext);
      }
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private decryptSensitiveDataByDataKey(ciphertext: string): string {
    if (!this.sensitiveDataKey) {
      throw new Error('Sensitive data key not initialized. Call init() first.');
    }

    try {
      const parts = ciphertext.split('^');
      if (parts.length !== this.CONSTANTS.OLD_CIPHERTEXT_SPLIT_LEN) {
        throw new Error('Invalid legacy ciphertext format');
      }

      const [rootKeyVersion, secretData] = parts;
      if (rootKeyVersion !== this.CONSTANTS.DEFAULT_ROOT_KEY_VERSION || !secretData) {
        throw new Error('Invalid legacy ciphertext: version mismatch or missing secret data');
      }

      return this.aesCbcDecrypt(secretData, this.sensitiveDataKey);
    } catch (error) {
      throw new Error(`Legacy decryption failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// 兼容性导出
export { Encryption as EncryptionUtil };
