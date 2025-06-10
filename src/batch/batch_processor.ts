import { SensitiveData } from '../sensitive/sensitive_data';

export interface BatchProcessorOptions {
  batchSize?: number;
  concurrency?: number;
  onProgress?: (processed: number, total: number) => void;
}

export class BatchProcessor {
  private sensitiveData: SensitiveData;
  private options: Required<BatchProcessorOptions>;

  constructor(sensitiveData: SensitiveData, options: BatchProcessorOptions = {}) {
    this.sensitiveData = sensitiveData;
    this.options = {
      batchSize: options.batchSize || 1000,
      concurrency: options.concurrency || 4,
      onProgress: options.onProgress || (() => {})
    };
  }

  /**
   * 批量加密字符串数组
   */
  async batchEncrypt(data: string[]): Promise<string[]> {
    return this.processBatch(data, (item) => 
      this.sensitiveData.aes128Sha256EncryptSensitiveData(item)
    );
  }

  /**
   * 批量解密字符串数组
   */
  async batchDecrypt(data: string[]): Promise<string[]> {
    return this.processBatch(data, (item) => 
      this.sensitiveData.aes128Sha256DecryptSensitiveData(item)
    );
  }

  /**
   * 批量加密对象数组中的敏感字段
   */
  async batchEncryptObjects<T extends Record<string, any>>(
    data: T[], 
    sensitiveFields: string[]
  ): Promise<T[]> {
    return this.processBatch(data, (item) => 
      this.encryptObjectFields(item, sensitiveFields)
    );
  }

  /**
   * 批量解密对象数组中的敏感字段
   */
  async batchDecryptObjects<T extends Record<string, any>>(
    data: T[], 
    sensitiveFields: string[]
  ): Promise<T[]> {
    return this.processBatch(data, (item) => 
      this.decryptObjectFields(item, sensitiveFields)
    );
  }

  /**
   * 流式处理大数据集
   */
  async * streamProcess<T, R>(
    data: T[],
    processor: (item: T) => R,
    batchSize: number = this.options.batchSize
  ): AsyncGenerator<R[], void, unknown> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(processor));
      yield results;
    }
  }

  /**
   * 流式加密
   */
  async * streamEncrypt(data: string[]): AsyncGenerator<string[], void, unknown> {
    yield* this.streamProcess(data, (item) => 
      this.sensitiveData.aes128Sha256EncryptSensitiveData(item)
    );
  }

  /**
   * 流式解密
   */
  async * streamDecrypt(data: string[]): AsyncGenerator<string[], void, unknown> {
    yield* this.streamProcess(data, (item) => 
      this.sensitiveData.aes128Sha256DecryptSensitiveData(item)
    );
  }

  /**
   * 核心批量处理方法
   */
  private async processBatch<T, R>(
    data: T[],
    processor: (item: T) => R
  ): Promise<R[]> {
    const results: R[] = [];
    let processed = 0;

    // 分批处理
    for (let i = 0; i < data.length; i += this.options.batchSize) {
      const batch = data.slice(i, i + this.options.batchSize);
      
      // 并发处理当前批次
      const batchResults = await this.processBatchConcurrently(batch, processor);
      results.push(...batchResults);
      
      processed += batch.length;
      this.options.onProgress(processed, data.length);
    }

    return results;
  }

  /**
   * 并发处理单个批次
   */
  private async processBatchConcurrently<T, R>(
    batch: T[],
    processor: (item: T) => R
  ): Promise<R[]> {
    const results: R[] = [];
    const chunks = this.chunkArray(batch, Math.ceil(batch.length / this.options.concurrency));

    const chunkPromises = chunks.map(async (chunk) => {
      return Promise.all(chunk.map(processor));
    });

    const chunkResults = await Promise.all(chunkPromises);
    chunkResults.forEach(chunkResult => results.push(...chunkResult));

    return results;
  }

  /**
   * 加密对象中的敏感字段
   */
  private encryptObjectFields<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: string[]
  ): T {
    const result = { ...obj } as T;
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        (result as any)[field] = this.sensitiveData.aes128Sha256EncryptSensitiveData(result[field] as string);
      }
    }
    
    return result;
  }

  /**
   * 解密对象中的敏感字段
   */
  private decryptObjectFields<T extends Record<string, any>>(
    obj: T, 
    sensitiveFields: string[]
  ): T {
    const result = { ...obj } as T;
    
    for (const field of sensitiveFields) {
      if (result[field] && typeof result[field] === 'string') {
        (result as any)[field] = this.sensitiveData.aes128Sha256DecryptSensitiveData(result[field] as string);
      }
    }
    
    return result;
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
} 