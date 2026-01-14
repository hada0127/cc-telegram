/**
 * Config 유틸리티 함수
 */

import fs from 'fs/promises';

/**
 * config.json 파일을 원시 형태로 로드 (기본값 적용 없이)
 * 마이그레이션 시 필드 존재 여부 확인용
 * @param {string} configPath - config.json 파일 경로
 * @returns {Promise<object|null>} - 원시 config 객체 또는 파일이 없으면 null
 */
export async function loadRawConfig(configPath) {
  try {
    const content = await fs.readFile(configPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
