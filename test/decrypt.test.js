const { SensitiveData } = require('../dist/sensitive_data');

describe('Decrypt Test Cases', () => {
  let sensitiveData;

  beforeAll(() => {
    sensitiveData = new SensitiveData();
    // 初始化加密密钥
    const cbcKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const rootKey = {
      "0001": "0123456789abcdef0123456789abcdef"
    };
    sensitiveData.initSensitiveKey(cbcKey, rootKey);
  });

  const testCases = {
    empty_string: {
      input: "",
      encrypted: '',
    },
    newline: {
      input: "\n",
      encrypted: '0001^43ZKRv9qeDuQfn9Osaa5jOaOjDarCOR0irf0b7a+Neuuc2ISpZAGXGtiBBbusxjwHkgJ0EpPXWeqTQZnM/24Ug==^01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b^tFCfisC6ZSxqMiAqwUps9ZLIabVD3hgxVpjCYqnfedQ=',
    },
    tab: {
      input: "\t",
      encrypted: '0001^1bZegEKH5PEKEmpZ/xbbn0FcwXnougiQgVvPtN2H1ZtX13MXpIlOnUhYCzgwRraxBTmKyhBAZ4cN4iRJmsWv1Q==^2b4c342f5433ebe591a1da77e013d1b72475562d48578dca8b84bac6651c3cb9^jDddN9UIB5cTkVs8zHj2NTcsAu6WqyLs6NveyoSG+bA=',
    },
    chinese: {
      input: "这是中文测试",
      encrypted: '0001^eA7RoO08Laew/+NsViEAQ9XCpYH3+KUyiie/Sm1QIu6/+IJWtoIA0Gl7UXdArdTDLK1+RsQIU4ZsoAXW/Tq8IQ==^cd78f6be8972066d2c4eb873fcfe87be7edb8bdf918b83bec09a47e7ed255f36^aFLecSb6NuJjj+fpR6fs5pQEI+9p1KPPMF/Wsh4k6w+A3zXwbUAFQs7oddSSDFa+',
    },
    japanese: {
      input: "これは日本語です",
      encrypted: '0001^oJKIrrIHYSWnv00ipCb9E1K94g6P06KfutrPKzLmmw2mGvC4p16DymLxpUrUkV0ZZjEIcdxyyJRrKXZKl1GZTA==^3a57bd94b9bcda801052f149337366d3ec00555c67efaf5d355c80d347678061^OeYz+rsHmuBHzxG8YdvSt3us3YM3EVjsZtiAYXWhl4Y8BMudOOIWxnQj5LVTkzWj',
    },
    json_string: {
      input: "{\"key\": \"value\", \"chinese\": \"中文\"}",
      encrypted: '0001^JZC9vHiiDtPAMZf/9XW9NOkgyuxu0xDkSRc+mYkHAtDKKzKeGxBLs8eeATSZ+XBBOE64OKokmM0VY6Cp2QUAfA==^4fc0f4fa0d02ef6da9bdd535857bb258856e3547cbf9cbfc07d33424ac8757b3^LLHe21lfhIz4z3Pe/BqjftrHekz/LKiLmXUxqsU0JZrlBO2EcyFlpoem8zZsdZ1/wJtYq3OsJaQXBI8rXRcDEg==',
    },
  };

  Object.entries(testCases).forEach(([name, testCase]) => {
    test(`should correctly decrypt ${name}`, () => {
      if (!testCase.encrypted) {
        expect(testCase.encrypted).toBe('');
        return;
      }

      const decrypted = sensitiveData.aes128Sha256DecryptSensitiveData(testCase.encrypted);
      expect(decrypted).toBe(testCase.input);
    });
  });
}); 