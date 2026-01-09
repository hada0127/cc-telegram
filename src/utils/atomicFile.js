/**
 * 원자적 파일 쓰기
 * 임시파일에 쓴 후 rename으로 이동하여 파일 손상 방지
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * 원자적으로 파일 쓰기
 * 임시파일에 먼저 쓰고 rename으로 이동
 * @param {string} filePath - 대상 파일 경로
 * @param {string} content - 쓸 내용
 */
export async function atomicWriteFile(filePath, content) {
  const dir = path.dirname(filePath);
  const fileName = path.basename(filePath);
  const tempFileName = `.${fileName}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tempPath = path.join(dir, tempFileName);

  try {
    // 임시 파일에 쓰기
    await fs.writeFile(tempPath, content, 'utf8');

    // 원자적으로 이동 (rename은 같은 파일시스템에서 원자적)
    await fs.rename(tempPath, filePath);
  } catch (err) {
    // 실패 시 임시 파일 정리 시도
    try {
      await fs.unlink(tempPath);
    } catch {
      // 무시
    }
    throw err;
  }
}

/**
 * 원자적으로 JSON 파일 쓰기
 * @param {string} filePath - 대상 파일 경로
 * @param {object} data - 저장할 객체
 * @param {number} [indent=2] - JSON 들여쓰기
 */
export async function atomicWriteJson(filePath, data, indent = 2) {
  const content = JSON.stringify(data, null, indent);
  await atomicWriteFile(filePath, content);
}
