import * as crypto from 'crypto';

/**
 * 哈希工具类
 * 提供SHA256哈希功能
 */
export class HashUtil {
  /**
   * 计算字符串的SHA256哈希值
   * @param text 要哈希的文本
   * @param encoding 输出编码格式，默认为'hex'
   * @returns SHA256哈希值
   */
  static sha256(text: string, encoding: crypto.BinaryToTextEncoding = 'hex'): string {
    if (!text) return '';
    
    try {
      const utf8Text = String(text);
      return crypto.createHash('sha256')
        .update(utf8Text, 'utf8')
        .digest(encoding);
    } catch (error) {
      throw new Error(`SHA256哈希计算失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 验证文本的SHA256哈希值
   * @param text 原始文本
   * @param expectedHash 期望的哈希值
   * @param encoding 哈希值编码格式，默认为'hex'
   * @returns 是否匹配
   */
  static verifySha256(text: string, expectedHash: string, encoding: crypto.BinaryToTextEncoding = 'hex'): boolean {
    try {
      const actualHash = this.sha256(text, encoding);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }
} 