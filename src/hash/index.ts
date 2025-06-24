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
   * @returns SHA256哈希值，如果输入为null或undefined则返回null
   */
  static sha256(text: string | null | undefined, encoding: crypto.BinaryToTextEncoding = 'hex'): string | null {
    // 如果传入null或undefined，直接返回null
    if (text === null || text === undefined) return null;
    
    // 转换为字符串、去除前后空格、转小写
    const normalizedText = String(text).trim().toLowerCase();
    
    // 如果处理后为空字符串，返回空字符串的哈希值
    if (normalizedText === '') {
      return crypto.createHash('sha256')
        .update('', 'utf8')
        .digest(encoding);
    }
    
    try {
      return crypto.createHash('sha256')
        .update(normalizedText, 'utf8')
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
  static verifySha256(text: string | null | undefined, expectedHash: string, encoding: crypto.BinaryToTextEncoding = 'hex'): boolean {
    try {
      const actualHash = this.sha256(text, encoding);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }
} 