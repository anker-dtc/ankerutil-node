/**
 * 敏感配置管理模块
 * 处理 Nacos 配置中的 {{xxx}} 变量形态隐秘字段
 * 通过外部服务进行解密处理
 */

import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';



/**
 * 敏感配置管理配置选项
 */
export interface SecretManageConfig {
  /** 系统名称 */
  Name: string;
  /** 系统密钥 */
  Key: string;
  /** 服务域名 */
  Domain: string;
}

/**
 * 认证信息
 */
interface AuthInfo {
  /** 系统名称 */
  system_name: string;
  /** 时间戳 */
  timestamp: number;
  /** 签名 */
  signature: string;
}

/**
 * 敏感配置管理请求体
 */
interface SecretManageRequest {
  /** 认证信息 */
  auth: AuthInfo;
  /** 配置内容 */
  config: string;
}

/**
 * 敏感配置管理响应体
 */
interface SecretManageResponse {
  /** 状态码 */
  code: number;
  /** 消息 */
  msg: string;
  /** 数据 */
  data: { [key: string]: string } | null;
  /** 跟踪ID */
  trace_id: string;
}

/**
 * 敏感配置管理错误
 */
export class SecretManageError extends Error {
  constructor(
    message: string,
    public operation: string,
    public statusCode?: number,
    public traceId?: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SecretManageError';
  }
}

/**
 * 敏感配置管理客户端
 */
export class SecretManager {
  private config: SecretManageConfig;

  constructor(config: SecretManageConfig) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * 验证配置完整性
   */
  private validateConfig(): void {
    if (!this.config.Name || !this.config.Key || !this.config.Domain) {
      throw new SecretManageError(
        '敏感配置管理配置不完整，需要 Name、Key 和 Domain',
        'validate_config'
      );
    }
  }

  /**
   * 处理敏感配置
   * 支持 JSON、YAML 和 INI 格式的配置解析
   * @param content 配置内容
   * @returns 处理后的配置内容
   */
  async processSecretConfig(content: string): Promise<string> {
    try {
      console.log('[SecretManager] 开始处理敏感配置');
      console.log('[SecretManager] 配置内容长度:', content.length);
      console.log('[SecretManager] 配置内容预览:', content.substring(0, 200) + '...');
      console.log('[SecretManager] 使用外部传入配置:', JSON.stringify(this.config, null, 2));
      
      // 检查配置内容中是否包含敏感字段标识符 {{xxx}}
      if (!this.containsSecretFields(content)) {
        console.log('[SecretManager] 配置内容不包含敏感字段标识符，返回原始内容');
        return content;
      }

      // 解析配置内容中的 SecretManage 配置
      console.log('[SecretManager] 解析配置内容中的 SecretManage 配置...');
      const parsedConfig = this.parseConfigContent(content);
      console.log('[SecretManager] 解析结果:', JSON.stringify(parsedConfig, null, 2));
      
      // 确定最终使用的配置（优先使用外部传入的配置）
      const finalConfig = this.mergeConfigs(parsedConfig);
      console.log('[SecretManager] 最终使用的配置:', JSON.stringify({
        Name: finalConfig.Name,
        Key: finalConfig.Key ? finalConfig.Key.substring(0, 8) + '...' : 'undefined',
        Domain: finalConfig.Domain
      }, null, 2));

      // 验证最终配置的完整性
      if (!this.isValidSecretConfig(finalConfig)) {
        console.log('[SecretManager] 最终配置不完整，返回原始内容');
        return content;
      }

      // 调用敏感配置管理 API（使用最终配置，但不覆盖 this.config）
      console.log('[SecretManager] 调用敏感配置管理 API...');
      const decryptedContent = await this.callSecretManageAPIWithConfig(content, finalConfig);
      
      console.log('[SecretManager] 敏感配置处理成功');
      return decryptedContent;

    } catch (error) {
      console.error('[SecretManager] 处理敏感配置时发生错误:');
      console.error('[SecretManager] 错误类型:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('[SecretManager] 错误信息:', error instanceof Error ? error.message : String(error));
      console.error('[SecretManager] 错误堆栈:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[SecretManager] 外部传入配置:', JSON.stringify(this.config, null, 2));
      
      throw new SecretManageError(
        `处理敏感配置失败: ${error instanceof Error ? error.message : String(error)}`,
        'process_secret_config',
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 解析配置内容，支持 JSON、YAML 和 INI 格式
   * @param content 配置内容
   * @returns 解析出的 SecretManage 配置
   */
  private parseConfigContent(content: string): SecretManageConfig {
    // 尝试 JSON 解析
    try {
      const jsonConfig = JSON.parse(content);
      
      // 支持嵌套结构和平级结构
      if (jsonConfig.SecretManage) {
        return {
          Name: jsonConfig.SecretManage.Name,
          Key: jsonConfig.SecretManage.Key,
          Domain: jsonConfig.SecretManage.Domain
        };
      }
      
      // 平级结构
      if (jsonConfig['SecretManage.Name']) {
        return {
          Name: jsonConfig['SecretManage.Name'],
          Key: jsonConfig['SecretManage.Key'],
          Domain: jsonConfig['SecretManage.Domain']
        };
      }
    } catch (jsonError) {
      console.log('JSON 解析失败，尝试其他格式:', jsonError);
    }

    // 尝试 YAML 解析（简单实现）
    try {
      const yamlConfig = this.parseSimpleYaml(content);
      if (yamlConfig.Name && yamlConfig.Key && yamlConfig.Domain) {
        return yamlConfig;
      }
    } catch (yamlError) {
      console.log('YAML 解析失败:', yamlError);
    }

    // 尝试 INI 解析（简单实现）
    try {
      const iniConfig = this.parseSimpleIni(content);
      if (iniConfig.Name && iniConfig.Key && iniConfig.Domain) {
        return iniConfig;
      }
    } catch (iniError) {
      console.log('INI 解析失败:', iniError);
    }

    // 返回空配置
    return { Name: '', Key: '', Domain: '' };
  }

  /**
   * 简单 YAML 解析器（仅支持基本的键值对）
   */
  private parseSimpleYaml(content: string): SecretManageConfig {
    const config: SecretManageConfig = { Name: '', Key: '', Domain: '' };
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes(':')) {
        const [key, ...valueParts] = trimmedLine.split(':');
        const value = valueParts.join(':').trim().replace(/["']/g, '');
        
        const cleanKey = key.trim();
        
        if (cleanKey === 'SecretManage.Name' || cleanKey.endsWith('.Name')) {
          config.Name = value;
        } else if (cleanKey === 'SecretManage.Key' || cleanKey.endsWith('.Key')) {
          config.Key = value;
        } else if (cleanKey === 'SecretManage.Domain' || cleanKey.endsWith('.Domain')) {
          config.Domain = value;
        }
      }
    }
    
    return config;
  }

  /**
   * 简单 INI 解析器
   */
  private parseSimpleIni(content: string): SecretManageConfig {
    const config: SecretManageConfig = { Name: '', Key: '', Domain: '' };
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.includes('=') && !trimmedLine.startsWith(';') && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        const value = valueParts.join('=').trim().replace(/["']/g, '');
        
        const cleanKey = key.trim();
        
        if (cleanKey === 'SecretManage.Name') {
          config.Name = value;
        } else if (cleanKey === 'SecretManage.Key') {
          config.Key = value;
        } else if (cleanKey === 'SecretManage.Domain') {
          config.Domain = value;
        }
      }
    }
    
    return config;
  }

  /**
   * 检查配置内容是否包含敏感字段标识符
   * @param content 配置内容
   * @returns 是否包含敏感字段
   */
  private containsSecretFields(content: string): boolean {
    // 检查是否包含 {{xxx}} 格式的敏感字段标识符
    const secretFieldPattern = /\{\{[^}]+\}\}/;
    return secretFieldPattern.test(content);
  }

  /**
   * 合并配置（优先使用外部传入的配置）
   * @param parsedConfig 从配置内容中解析出的配置
   * @returns 合并后的配置
   */
  private mergeConfigs(parsedConfig: SecretManageConfig): SecretManageConfig {
    return {
      // 优先使用外部传入的配置，如果外部配置为空才使用解析出的配置
      Name: this.config.Name || parsedConfig.Name,
      Key: this.config.Key || parsedConfig.Key,
      Domain: this.config.Domain || parsedConfig.Domain
    };
  }

  /**
   * 检查 SecretManage 配置是否有效
   */
  private isValidSecretConfig(config: SecretManageConfig): boolean {
    return !!(config.Name && config.Key && config.Domain);
  }

  /**
   * 生成 HMAC-SHA256 签名
   * @param message 签名消息
   * @param key 密钥
   * @returns 十六进制签名
   */
  private generateSignature(message: string, key: string): string {
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(message);
    return hmac.digest('hex');
  }

  /**
   * 调用敏感配置管理 API（使用指定配置）
   * @param content 配置内容
   * @param config 使用的配置
   * @returns 解密后的配置内容
   */
  private async callSecretManageAPIWithConfig(content: string, config: SecretManageConfig): Promise<string> {
    console.log('[SecretManager] 调用 API 前的配置检查:');
    console.log('[SecretManager] config.Name:', config.Name);
    console.log('[SecretManager] config.Key:', config.Key ? `${config.Key.substring(0, 8)}...` : 'undefined');
    console.log('[SecretManager] config.Domain:', config.Domain);
    
    const timestamp = Math.floor(Date.now() / 1000);
    console.log('[SecretManager] timestamp:', timestamp);
    
    // 生成签名
    const message = `SecretManageAnker+${timestamp}+${config.Name}+${config.Key}`;
    console.log('[SecretManager] 签名消息:', `SecretManageAnker+${timestamp}+${config.Name}+${config.Key ? config.Key.substring(0, 8) + '...' : 'undefined'}`);
    
    try {
      const signature = this.generateSignature(message, config.Key);
      console.log('[SecretManager] 签名生成成功:', signature.substring(0, 8) + '...');
    } catch (signatureError) {
      console.error('[SecretManager] 签名生成失败:', signatureError);
      throw signatureError;
    }
    
    const signature = this.generateSignature(message, config.Key);

    // 构造请求体
    const requestBody: SecretManageRequest = {
      auth: {
        system_name: config.Name,
        timestamp,
        signature
      },
      config: content
    };

    const jsonData = JSON.stringify(requestBody);
    const url = `${config.Domain}/secretmanage/decrypt/config`;

    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(jsonData)
        },
        timeout: 10000 // 10秒超时
      };

      const req = client.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const response: SecretManageResponse = JSON.parse(responseData);
            
            if (response.code !== 0) {
              reject(new SecretManageError(
                `API 返回错误: ${response.msg}`,
                'api_error',
                response.code,
                response.trace_id
              ));
              return;
            }

            if (!response.data) {
              reject(new SecretManageError(
                '响应数据为空',
                'empty_response',
                undefined,
                response.trace_id
              ));
              return;
            }

            const configValue = response.data['config'];
            if (!configValue) {
              reject(new SecretManageError(
                '响应数据中不包含 config 字段',
                'missing_config_field',
                undefined,
                response.trace_id
              ));
              return;
            }

            resolve(configValue);
          } catch (parseError) {
            reject(new SecretManageError(
              `解析响应失败: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
              'parse_response',
              undefined,
              undefined,
              parseError instanceof Error ? parseError : undefined
            ));
          }
        });
      });

      req.on('error', (error) => {
        reject(new SecretManageError(
          `请求失败: ${error.message}`,
          'request_error',
          undefined,
          undefined,
          error
        ));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new SecretManageError(
          '请求超时',
          'request_timeout'
        ));
      });

      // 发送请求数据
      req.write(jsonData);
      req.end();
    });
  }

  /**
   * 调用敏感配置管理 API（兼容性方法，使用实例配置）
   * @param content 配置内容
   * @returns 解密后的配置内容
   */
  private async callSecretManageAPI(content: string): Promise<string> {
    // 委托给新的方法，使用实例配置
    return this.callSecretManageAPIWithConfig(content, this.config);
  }
}

/**
 * 创建敏感配置管理器
 * @param config 敏感配置管理配置
 * @returns 敏感配置管理器实例
 */
export function createSecretManager(config: SecretManageConfig): SecretManager {
  return new SecretManager(config);
}

// SecretManageConfig 接口已在上面定义并导出