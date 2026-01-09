/**
 * 암호화/복호화 유틸리티
 * 사용자 환경 기반 키 생성으로 다른 환경에서 복호화 불가
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { hostname, userInfo, homedir } from 'os';

const ALGORITHM = 'aes-256-gcm';

/**
 * 사용자 환경 기반 암호화 키 생성
 * @returns {string} 32바이트 hex 키
 */
export function generateKey() {
  const data = [
    hostname(),
    userInfo().username,
    homedir(),
    process.arch,
    process.platform
  ].join('|');

  return createHash('sha256').update(data).digest('hex').slice(0, 32);
}

/**
 * 문자열 암호화
 * @param {string} text - 암호화할 텍스트
 * @param {string} [key] - 암호화 키 (기본: 환경 기반 키)
 * @returns {string} iv:authTag:encrypted 형식
 */
export function encrypt(text, key = generateKey()) {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
}

/**
 * 문자열 복호화
 * @param {string} encryptedData - iv:authTag:encrypted 형식
 * @param {string} [key] - 복호화 키 (기본: 환경 기반 키)
 * @returns {string} 복호화된 텍스트
 */
export function decrypt(encryptedData, key = generateKey()) {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
