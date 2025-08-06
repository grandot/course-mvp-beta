/**
 * Redis 服務封裝模組
 * 提供標準化的 Redis 操作介面，支援多輪對話功能
 * 
 * 功能特色：
 * - 自動重連機制
 * - 連接池管理
 * - 優雅降級處理
 * - TTL 自動設定
 */

const Redis = require('ioredis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
    
    // 檢查是否有 Redis 配置
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      console.warn('⚠️ Redis 環境變數未設定，多輪對話功能將不可用');
      this.config = null;
      return;
    }
    
    // 優先使用 Redis URL，否則使用分別參數
    if (process.env.REDIS_URL) {
      this.config = process.env.REDIS_URL;
    } else {
      // 手動組裝配置
      this.config = {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        retryDelayOnError: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      };
      
      // 如果需要 TLS
      if (process.env.REDIS_TLS === 'true') {
        this.config.tls = {};
      }
    }
  }
  
  /**
   * 初始化 Redis 連接
   * @returns {Promise<boolean>} 連接是否成功
   */
  async connect() {
    if (this.isConnected) {
      return true;
    }
    
    // 如果沒有配置，直接返回失敗
    if (!this.config) {
      return false;
    }
    
    try {
      this.client = new Redis(this.config);
      
      // 設定事件監聽器
      this.client.on('connect', () => {
        console.log('✅ Redis 連接成功');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });
      
      this.client.on('error', (error) => {
        console.error('❌ Redis 連接錯誤:', error.message);
        this.isConnected = false;
      });
      
      this.client.on('close', () => {
        console.log('🔌 Redis 連接已關閉');
        this.isConnected = false;
      });
      
      // 測試連接
      await this.client.ping();
      return true;
      
    } catch (error) {
      console.error('❌ Redis 連接失敗:', error.message);
      this.connectionAttempts++;
      
      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        console.error(`❌ Redis 連接嘗試 ${this.maxConnectionAttempts} 次後放棄`);
      }
      
      return false;
    }
  }
  
  /**
   * 斷開 Redis 連接
   */
  async disconnect() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
  
  /**
   * 檢查 Redis 服務健康狀態
   * @returns {Promise<object>} 健康狀態資訊
   */
  async healthCheck() {
    try {
      // 如果沒有配置，返回不可用狀態
      if (!this.config) {
        return {
          status: 'unavailable',
          message: 'Redis 未配置，降級為無狀態處理',
          timestamp: new Date().toISOString()
        };
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return {
            status: 'unhealthy',
            message: 'Redis 連接失敗',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency: `${latency}ms`,
        connected: this.isConnected,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * 儲存資料到 Redis
   * @param {string} key - 鍵名
   * @param {any} value - 值（會自動序列化為 JSON）
   * @param {number} ttl - 過期時間（秒），預設 30 分鐘
   * @returns {Promise<boolean>} 是否成功
   */
  async set(key, value, ttl = 1800) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return false;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          console.warn('⚠️ Redis 不可用，資料儲存失敗');
          return false;
        }
      }
      
      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);
      await this.client.set(key, serializedValue, 'EX', ttl);
      return true;
      
    } catch (error) {
      console.error('❌ Redis 儲存失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 從 Redis 讀取資料
   * @param {string} key - 鍵名
   * @param {boolean} parseJson - 是否解析 JSON（預設 true）
   * @returns {Promise<any|null>} 資料或 null
   */
  async get(key, parseJson = true) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return null;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          console.warn('⚠️ Redis 不可用，資料讀取失敗');
          return null;
        }
      }
      
      const value = await this.client.get(key);
      if (value === null) {
        return null;
      }
      
      if (parseJson) {
        try {
          return JSON.parse(value);
        } catch (parseError) {
          console.warn('⚠️ JSON 解析失敗，回傳原始字串');
          return value;
        }
      }
      
      return value;
      
    } catch (error) {
      console.error('❌ Redis 讀取失敗:', error.message);
      return null;
    }
  }
  
  /**
   * 刪除 Redis 中的資料
   * @param {string} key - 鍵名
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(key) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return false;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          console.warn('⚠️ Redis 不可用，資料刪除失敗');
          return false;
        }
      }
      
      const result = await this.client.del(key);
      return result > 0;
      
    } catch (error) {
      console.error('❌ Redis 刪除失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 檢查鍵是否存在
   * @param {string} key - 鍵名
   * @returns {Promise<boolean>} 是否存在
   */
  async exists(key) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return false;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return false;
        }
      }
      
      const result = await this.client.exists(key);
      return result > 0;
      
    } catch (error) {
      console.error('❌ Redis exists 檢查失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 取得鍵的剩餘過期時間
   * @param {string} key - 鍵名
   * @returns {Promise<number>} 剩餘秒數，-1 表示永不過期，-2 表示不存在
   */
  async getTTL(key) {
    try {
      if (!this.config) {
        // 無 Redis 配置，回傳不存在
        return -2;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return -2;
        }
      }
      
      return await this.client.ttl(key);
      
    } catch (error) {
      console.error('❌ Redis TTL 查詢失敗:', error.message);
      return -2;
    }
  }
  
  /**
   * 延長鍵的過期時間
   * @param {string} key - 鍵名
   * @param {number} ttl - 新的過期時間（秒）
   * @returns {Promise<boolean>} 是否成功
   */
  async extend(key, ttl) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return false;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return false;
        }
      }
      
      const result = await this.client.expire(key, ttl);
      return result === 1;
      
    } catch (error) {
      console.error('❌ Redis 過期時間延長失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 批量操作：設定多個鍵值對
   * @param {Array<{key: string, value: any, ttl?: number}>} items - 鍵值對陣列
   * @returns {Promise<boolean>} 是否全部成功
   */
  async setBatch(items) {
    try {
      if (!this.config) {
        // 無 Redis 配置，靜默失敗
        return false;
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return false;
        }
      }
      
      const pipeline = this.client.pipeline();
      
      for (const item of items) {
        const serializedValue = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        const ttl = item.ttl || 1800;
        pipeline.set(item.key, serializedValue, 'EX', ttl);
      }
      
      const results = await pipeline.exec();
      return results.every(result => result[0] === null); // 檢查是否所有操作都成功
      
    } catch (error) {
      console.error('❌ Redis 批量操作失敗:', error.message);
      return false;
    }
  }
  
  /**
   * 搜尋符合模式的鍵
   * @param {string} pattern - 搜尋模式（如 "conversation:*"）
   * @returns {Promise<string[]>} 符合的鍵陣列
   */
  async scan(pattern) {
    try {
      if (!this.config) {
        // 無 Redis 配置，回傳空陣列
        return [];
      }
      
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          return [];
        }
      }
      
      const keys = [];
      let cursor = '0';
      
      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');
      
      return keys;
      
    } catch (error) {
      console.error('❌ Redis scan 失敗:', error.message);
      return [];
    }
  }
}

// 建立單例實例
let redisService = null;

/**
 * 取得 Redis 服務實例（單例模式）
 * @returns {RedisService}
 */
function getRedisService() {
  if (!redisService) {
    redisService = new RedisService();
  }
  return redisService;
}

module.exports = {
  RedisService,
  getRedisService
};