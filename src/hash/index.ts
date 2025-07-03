import * as crypto from 'crypto';

/**
 * 哈希工具类
 * 提供SHA256哈希功能
 */
export class Hash {
  /**
   * 计算字符串的SHA256哈希值（纯哈希，不做任何预处理）
   * @param text 要哈希的文本
   * @param encoding 输出编码格式，默认为'hex'
   * @returns SHA256哈希值，如果输入为null或undefined则返回null
   */
  static sha256(text: string | null | undefined, encoding: crypto.BinaryToTextEncoding = 'hex'): string | null {
    // 如果传入null或undefined，直接返回null
    if (text === null || text === undefined) return null;
    
    try {
      return crypto.createHash('sha256')
        .update(String(text), 'utf8')
        .digest(encoding);
    } catch (error) {
      throw new Error(`SHA256哈希计算失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 标准化文本（转换为字符串 -> 去除前后空格 -> 转小写）
   * @param text 要标准化的文本
   * @returns 标准化后的文本，如果输入为null或undefined则返回null
   */
  static normalize(text: string | null | undefined): string | null {
    // 如果传入null或undefined，直接返回null
    if (text === null || text === undefined) return null;
    
    // 转换为字符串、去除前后空格、转小写
    return String(text).trim().toLowerCase();
  }

  /**
   * 标准化文本后计算SHA256哈希值
   * @param text 要处理的文本
   * @param encoding 输出编码格式，默认为'hex'
   * @returns 标准化后的SHA256哈希值，如果输入为null或undefined则返回null
   */
  static normalizeSha256(text: string | null | undefined, encoding: crypto.BinaryToTextEncoding = 'hex'): string | null {
    const normalizedText = this.normalize(text);
    return this.sha256(normalizedText, encoding);
  }

  /**
   * 验证文本的SHA256哈希值（纯哈希验证）
   * @param text 原始文本
   * @param expectedHash 期望的哈希值
   * @param encoding 哈希值编码格式，默认为'hex'
   * @returns 是否匹配
   */
  static verify(text: string | null | undefined, expectedHash: string, encoding: crypto.BinaryToTextEncoding = 'hex'): boolean {
    try {
      const actualHash = this.sha256(text, encoding);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }

  /**
   * 验证标准化文本的SHA256哈希值
   * @param text 原始文本
   * @param expectedHash 期望的哈希值
   * @param encoding 哈希值编码格式，默认为'hex'
   * @returns 是否匹配
   */
  static verifyNormalized(text: string | null | undefined, expectedHash: string, encoding: crypto.BinaryToTextEncoding = 'hex'): boolean {
    try {
      const actualHash = this.normalizeSha256(text, encoding);
      return actualHash === expectedHash;
    } catch (error) {
      return false;
    }
  }
} 