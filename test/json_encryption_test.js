const { SensitiveData } = require('../dist/sensitive');
const { EncryptionSubscriber } = require('../dist/typeorm/subscriber');
const { EncryptedJsonField } = require('../dist/typeorm/json');

// 测试实体类
class TestEntity {
  // 不要在构造函数里初始化 __encryptedJsonFields
}

describe('JSON字段加密测试', () => {
  let sensitiveData;
  let subscriber;

  beforeEach(() => {
    sensitiveData = new SensitiveData();
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    sensitiveData.initSensitiveKey(cbcKey, rootKey);
    
    subscriber = new EncryptionSubscriber(sensitiveData, console);
  });

  describe('嵌套对象字段加密', () => {
    it('应该正确处理嵌套对象中的字段', () => {
      // 使用装饰器
      EncryptedJsonField({
        autoEncrypt: true,
        paths: ['name', 'idCard', 'contactInfo.email', 'contactInfo.phone'],
      })(TestEntity.prototype, 'personalInfo');

      const entity = new TestEntity();
      entity.personalInfo = {
        name: '张三',
        idCard: '123456789012345678',
        contactInfo: {
          email: 'zhangsan@example.com',
          phone: '13800138000'
        }
      };

      // 手动触发加密
      const encryptedFields = entity.constructor.__encryptedJsonFields;
      const { field, options } = encryptedFields[0];
      
      // 模拟加密过程
      const fieldValue = entity[field];
      subscriber.processNestedFields(fieldValue, options.paths, 'encrypt');
      
      // 验证加密结果
      expect(entity.personalInfo.name).not.toBe('张三');
      expect(entity.personalInfo.idCard).not.toBe('123456789012345678');
      expect(entity.personalInfo.contactInfo.email).not.toBe('zhangsan@example.com');
      expect(entity.personalInfo.contactInfo.phone).not.toBe('13800138000');
      
      // 验证解密
      subscriber.processNestedFields(fieldValue, options.paths, 'decrypt');
      expect(entity.personalInfo.name).toBe('张三');
      expect(entity.personalInfo.idCard).toBe('123456789012345678');
      expect(entity.personalInfo.contactInfo.email).toBe('zhangsan@example.com');
      expect(entity.personalInfo.contactInfo.phone).toBe('13800138000');
    });
  });

  describe('数组字段加密', () => {
    it('应该正确处理数组中的嵌套字段', () => {
      // 使用装饰器
      EncryptedJsonField({
        autoEncrypt: true,
        paths: ['[].street', '[].city', '[].postalCode', '[].country', '[].contacts[].email', '[].contacts[].phone'],
      })(TestEntity.prototype, 'addresses');

      const entity = new TestEntity();
      entity.addresses = [
        {
          street: '北京市朝阳区',
          city: '北京',
          postalCode: '100000',
          country: '中国',
          contacts: [
            { email: 'contact1@example.com', phone: '13800138001' },
            { email: 'contact2@example.com', phone: '13800138002' }
          ]
        },
        {
          street: '上海市浦东新区',
          city: '上海',
          postalCode: '200000',
          country: '中国',
          contacts: [
            { email: 'contact3@example.com', phone: '13800138003' }
          ]
        }
      ];

      // 手动触发加密
      const encryptedFields = entity.constructor.__encryptedJsonFields;
      const { field, options } = encryptedFields[0];
      
      // 模拟加密过程
      const fieldValue = entity[field];
      subscriber.processNestedFields(fieldValue, options.paths, 'encrypt');
      
      // 验证加密结果
      expect(entity.addresses[0].street).not.toBe('北京市朝阳区');
      expect(entity.addresses[0].contacts[0].email).not.toBe('contact1@example.com');
      expect(entity.addresses[1].city).not.toBe('上海');
      
      // 验证解密
      subscriber.processNestedFields(fieldValue, options.paths, 'decrypt');
      expect(entity.addresses[0].street).toBe('北京市朝阳区');
      expect(entity.addresses[0].contacts[0].email).toBe('contact1@example.com');
      expect(entity.addresses[1].city).toBe('上海');
    });
  });
});
