/**
 * encryption.js 단위 테스트
 */

import { jest } from '@jest/globals';

// 모듈 동적 import
let encryptionModule;

beforeAll(async () => {
  encryptionModule = await import('../src/utils/encryption.js');
});

describe('generateKey', () => {
  test('32자 길이의 키를 생성해야 함', () => {
    const key = encryptionModule.generateKey();
    expect(key).toHaveLength(32);
  });

  test('동일한 환경에서는 같은 키를 생성해야 함', () => {
    const key1 = encryptionModule.generateKey();
    const key2 = encryptionModule.generateKey();
    expect(key1).toBe(key2);
  });

  test('키는 16진수 문자열이어야 함', () => {
    const key = encryptionModule.generateKey();
    expect(key).toMatch(/^[0-9a-f]+$/);
  });
});

describe('encrypt', () => {
  test('문자열을 암호화해야 함', () => {
    const plaintext = 'Hello, World!';
    const encrypted = encryptionModule.encrypt(plaintext);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toContain(':');
  });

  test('암호화된 문자열은 iv:authTag:encrypted 형식이어야 함', () => {
    const plaintext = 'test data';
    const encrypted = encryptionModule.encrypt(plaintext);

    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);

    // IV는 16바이트 = 32자 hex
    expect(parts[0]).toHaveLength(32);
    // authTag는 16바이트 = 32자 hex
    expect(parts[1]).toHaveLength(32);
    // encrypted data는 가변 길이
    expect(parts[2].length).toBeGreaterThan(0);
  });

  test('같은 평문도 매번 다른 암호문을 생성해야 함 (IV가 랜덤)', () => {
    const plaintext = 'same text';
    const encrypted1 = encryptionModule.encrypt(plaintext);
    const encrypted2 = encryptionModule.encrypt(plaintext);

    expect(encrypted1).not.toBe(encrypted2);
  });

  test('빈 문자열도 암호화할 수 있어야 함', () => {
    const plaintext = '';
    const encrypted = encryptionModule.encrypt(plaintext);

    expect(encrypted).toContain(':');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
  });

  test('유니코드 문자열을 암호화할 수 있어야 함', () => {
    const plaintext = '안녕하세요! 🔐 测试';
    const encrypted = encryptionModule.encrypt(plaintext);

    expect(encrypted).toContain(':');
    expect(encrypted).not.toBe(plaintext);
  });
});

describe('decrypt', () => {
  test('암호화된 문자열을 복호화해야 함', () => {
    const plaintext = 'Hello, World!';
    const encrypted = encryptionModule.encrypt(plaintext);
    const decrypted = encryptionModule.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('빈 문자열을 복호화할 수 있어야 함', () => {
    const plaintext = '';
    const encrypted = encryptionModule.encrypt(plaintext);
    const decrypted = encryptionModule.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('유니코드 문자열을 복호화할 수 있어야 함', () => {
    const plaintext = '안녕하세요! 🔐 测试';
    const encrypted = encryptionModule.encrypt(plaintext);
    const decrypted = encryptionModule.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('긴 문자열을 암호화/복호화할 수 있어야 함', () => {
    const plaintext = 'A'.repeat(10000);
    const encrypted = encryptionModule.encrypt(plaintext);
    const decrypted = encryptionModule.decrypt(encrypted);

    expect(decrypted).toBe(plaintext);
  });

  test('잘못된 authTag로 복호화하면 오류가 발생해야 함', () => {
    const plaintext = 'test data';
    const encrypted = encryptionModule.encrypt(plaintext);

    // authTag를 변조
    const parts = encrypted.split(':');
    parts[1] = '00'.repeat(16); // 잘못된 authTag
    const tampered = parts.join(':');

    expect(() => {
      encryptionModule.decrypt(tampered);
    }).toThrow();
  });

  test('잘못된 IV로 복호화하면 오류가 발생해야 함', () => {
    const plaintext = 'test data';
    const encrypted = encryptionModule.encrypt(plaintext);

    // IV를 변조
    const parts = encrypted.split(':');
    parts[0] = '00'.repeat(16); // 잘못된 IV
    const tampered = parts.join(':');

    expect(() => {
      encryptionModule.decrypt(tampered);
    }).toThrow();
  });
});

describe('encrypt/decrypt with custom key', () => {
  test('커스텀 키로 암호화/복호화할 수 있어야 함', () => {
    const customKey = 'a'.repeat(32); // 32자 키
    const plaintext = 'secret message';

    const encrypted = encryptionModule.encrypt(plaintext, customKey);
    const decrypted = encryptionModule.decrypt(encrypted, customKey);

    expect(decrypted).toBe(plaintext);
  });

  test('다른 키로 복호화하면 오류가 발생해야 함', () => {
    const key1 = 'a'.repeat(32);
    const key2 = 'b'.repeat(32);
    const plaintext = 'secret message';

    const encrypted = encryptionModule.encrypt(plaintext, key1);

    expect(() => {
      encryptionModule.decrypt(encrypted, key2);
    }).toThrow();
  });
});
