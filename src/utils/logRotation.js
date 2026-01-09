/**
 * 로그 로테이션 유틸리티
 * 설정된 기간이 지난 로그 파일을 자동으로 정리
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * 날짜 문자열 파싱 (YYYY-MM-DD 형식)
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseDateFromFilename(filename) {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})\.log$/);
  if (!match) return null;

  const date = new Date(match[1]);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 오래된 로그 파일 정리
 * @param {string} logsDir - 로그 디렉토리 경로
 * @param {number} retentionDays - 보관 기간 (일)
 * @returns {Promise<{deleted: number, errors: string[]}>}
 */
export async function cleanupOldLogs(logsDir, retentionDays = 7) {
  const result = { deleted: 0, errors: [] };

  try {
    const files = await fs.readdir(logsDir);
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));

    for (const file of files) {
      if (!file.endsWith('.log')) continue;

      const fileDate = parseDateFromFilename(file);
      if (!fileDate) continue;

      if (fileDate < cutoffDate) {
        try {
          const filePath = path.join(logsDir, file);
          await fs.unlink(filePath);
          result.deleted++;
        } catch (err) {
          /* istanbul ignore next */
          result.errors.push(`${file}: ${err.message}`);
        }
      }
    }
  } catch (err) {
    // 디렉토리가 없으면 무시
    /* istanbul ignore if */
    if (err.code !== 'ENOENT') {
      result.errors.push(`디렉토리 읽기 실패: ${err.message}`);
    }
  }

  return result;
}

/**
 * 완료/실패 작업 파일 정리
 * @param {string} dataDir - 데이터 디렉토리 경로
 * @param {number} retentionDays - 보관 기간 (일)
 * @returns {Promise<{completed: number, failed: number, errors: string[]}>}
 */
export async function cleanupOldTaskFiles(dataDir, retentionDays = 30) {
  const result = { completed: 0, failed: 0, errors: [] };
  const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

  // 완료된 작업 정리
  const completedDir = path.join(dataDir, 'completed');
  const completedIndexPath = path.join(dataDir, 'completed.json');

  try {
    const completedIndex = JSON.parse(await fs.readFile(completedIndexPath, 'utf8'));
    const tasksToKeep = [];

    for (const item of completedIndex.tasks) {
      const filePath = path.join(dataDir, item.file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const task = JSON.parse(content);
        const completedAt = new Date(task.completedAt);

        if (completedAt < cutoffDate) {
          await fs.unlink(filePath);
          result.completed++;
        } else {
          tasksToKeep.push(item);
        }
      } catch (err) {
        if (err.code === 'ENOENT') {
          // 파일이 없으면 인덱스에서도 제거
        } else {
          /* istanbul ignore next */
          result.errors.push(`completed/${item.id}: ${err.message}`);
          /* istanbul ignore next */
          tasksToKeep.push(item);
        }
      }
    }

    completedIndex.tasks = tasksToKeep;
    await fs.writeFile(completedIndexPath, JSON.stringify(completedIndex, null, 2));
  } catch (err) {
    /* istanbul ignore if */
    if (err.code !== 'ENOENT') {
      result.errors.push(`completed 인덱스: ${err.message}`);
    }
  }

  // 실패한 작업 정리
  const failedDir = path.join(dataDir, 'failed');
  const failedIndexPath = path.join(dataDir, 'failed.json');

  try {
    const failedIndex = JSON.parse(await fs.readFile(failedIndexPath, 'utf8'));
    const tasksToKeep = [];

    for (const item of failedIndex.tasks) {
      const filePath = path.join(dataDir, item.file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const task = JSON.parse(content);
        const failedAt = new Date(task.failedAt);

        if (failedAt < cutoffDate) {
          await fs.unlink(filePath);
          result.failed++;
        } else {
          tasksToKeep.push(item);
        }
      } catch (err) {
        /* istanbul ignore next */
        if (err.code === 'ENOENT') {
          // 파일이 없으면 인덱스에서도 제거
        } else {
          result.errors.push(`failed/${item.id}: ${err.message}`);
          tasksToKeep.push(item);
        }
      }
    }

    failedIndex.tasks = tasksToKeep;
    await fs.writeFile(failedIndexPath, JSON.stringify(failedIndex, null, 2));
  } catch (err) {
    /* istanbul ignore if */
    if (err.code !== 'ENOENT') {
      result.errors.push(`failed 인덱스: ${err.message}`);
    }
  }

  return result;
}

/**
 * 전체 정리 실행
 * @param {string} dataDir - 데이터 디렉토리 경로
 * @param {number} logRetentionDays - 로그 보관 기간 (일)
 * @param {number} taskRetentionDays - 작업 파일 보관 기간 (일)
 * @returns {Promise<{logs: object, tasks: object}>}
 */
export async function runCleanup(dataDir, logRetentionDays = 7, taskRetentionDays = 30) {
  const logsDir = path.join(dataDir, 'logs');

  const [logResult, taskResult] = await Promise.all([
    cleanupOldLogs(logsDir, logRetentionDays),
    cleanupOldTaskFiles(dataDir, taskRetentionDays)
  ]);

  return {
    logs: logResult,
    tasks: taskResult
  };
}
