/**
 * 작업 관리
 * 작업 생성, 상태 변경, 조회
 */

import fs from 'fs/promises';
import path from 'path';
import { getDataDir } from './config.js';
import { warn, error as logError } from './utils/logger.js';
import { atomicWriteJson } from './utils/atomicFile.js';

/**
 * 날짜 기반 ID 생성
 * 형식: YYYYMMDD-HHmmss-XXX (XXX는 랜덤 3자리)
 * @returns {string}
 */
function generateDateBasedId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');

  return `${year}${month}${day}-${hours}${minutes}${seconds}-${random}`;
}

/**
 * 우선순위 상수
 * @readonly
 * @enum {number}
 */
export const PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4
};

/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} requirement
 * @property {string} completionCriteria
 * @property {number} maxRetries
 * @property {number} currentRetry
 * @property {'ready'|'inProgress'} status
 * @property {number} priority - 우선순위 (1: low, 2: normal, 3: high, 4: urgent)
 * @property {string} createdAt
 * @property {string|null} startedAt
 * @property {string} workingDirectory
 */

/**
 * tasks.json 로드
 * @returns {Promise<{lastUpdated: string, tasks: Array}>}
 */
export async function loadTasksIndex() {
  const filePath = path.join(getDataDir(), 'tasks.json');
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * tasks.json 저장 (원자적 쓰기)
 * @param {object} data
 */
async function saveTasksIndex(data) {
  const filePath = path.join(getDataDir(), 'tasks.json');
  data.lastUpdated = new Date().toISOString();
  await atomicWriteJson(filePath, data);
}

/**
 * completed.json 로드
 */
export async function loadCompletedIndex() {
  const filePath = path.join(getDataDir(), 'completed.json');
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * failed.json 로드
 */
export async function loadFailedIndex() {
  const filePath = path.join(getDataDir(), 'failed.json');
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * 새 작업 생성
 * @param {object} params
 * @param {string} params.requirement
 * @param {string} params.completionCriteria
 * @param {number} params.maxRetries
 * @param {string} params.workingDirectory
 * @param {number} [params.priority=2] - 우선순위 (1: low, 2: normal, 3: high, 4: urgent)
 * @returns {Promise<Task>}
 */
export async function createTask({ requirement, completionCriteria, maxRetries, workingDirectory, priority = PRIORITY.NORMAL }) {
  const id = generateDateBasedId();
  const now = new Date().toISOString();

  /** @type {Task} */
  const task = {
    id,
    requirement,
    completionCriteria,
    maxRetries,
    currentRetry: 0,
    status: 'ready',
    priority,
    createdAt: now,
    startedAt: null,
    workingDirectory
  };

  // 개별 작업 파일 저장 (원자적 쓰기)
  const taskFile = path.join(getDataDir(), 'tasks', `${id}.json`);
  await atomicWriteJson(taskFile, task);

  // 인덱스 업데이트
  const index = await loadTasksIndex();
  index.tasks.push({
    id,
    file: `tasks/${id}.json`,
    status: 'ready',
    priority,
    createdAt: now
  });
  await saveTasksIndex(index);

  return task;
}

/**
 * 작업 상세 정보 로드
 * @param {string} taskId
 * @returns {Promise<Task>}
 */
export async function loadTask(taskId) {
  const taskFile = path.join(getDataDir(), 'tasks', `${taskId}.json`);
  const content = await fs.readFile(taskFile, 'utf8');
  return JSON.parse(content);
}

/**
 * 작업 저장 (원자적 쓰기)
 * @param {Task} task
 */
async function saveTask(task) {
  const taskFile = path.join(getDataDir(), 'tasks', `${task.id}.json`);
  await atomicWriteJson(taskFile, task);
}

/**
 * 다음 실행할 작업 가져오기 (우선순위 높은 것 먼저, 같으면 오래된 것 먼저)
 * @returns {Promise<Task|null>}
 */
export async function getNextTask() {
  const index = await loadTasksIndex();
  const readyTasks = index.tasks.filter(t => t.status === 'ready');

  if (readyTasks.length === 0) return null;

  // 우선순위 높은 것 먼저 (내림차순), 같으면 오래된 것 먼저 (오름차순)
  readyTasks.sort((a, b) => {
    const priorityA = a.priority || PRIORITY.NORMAL;
    const priorityB = b.priority || PRIORITY.NORMAL;

    // 우선순위가 다르면 높은 것이 먼저
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }

    // 우선순위가 같으면 오래된 것이 먼저
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const next = readyTasks[0];
  return loadTask(next.id);
}

/**
 * 작업 상태를 inProgress로 변경
 * @param {string} taskId
 */
export async function startTask(taskId) {
  const task = await loadTask(taskId);
  task.status = 'inProgress';
  task.startedAt = new Date().toISOString();
  await saveTask(task);

  // 인덱스 업데이트
  const index = await loadTasksIndex();
  const taskIndex = index.tasks.find(t => t.id === taskId);
  if (taskIndex) {
    taskIndex.status = 'inProgress';
  }
  await saveTasksIndex(index);

  return task;
}

/**
 * 작업 재시도 횟수 증가
 * @param {string} taskId
 * @returns {Promise<{task: Task, canRetry: boolean}>}
 */
export async function incrementRetry(taskId) {
  const task = await loadTask(taskId);
  task.currentRetry += 1;

  const canRetry = task.currentRetry < task.maxRetries;

  if (canRetry) {
    // 재시도 가능하면 상태를 ready로 변경
    task.status = 'ready';
    task.startedAt = null;
    await saveTask(task);

    // 인덱스도 업데이트
    const index = await loadTasksIndex();
    const taskIndex = index.tasks.find(t => t.id === taskId);
    if (taskIndex) {
      taskIndex.status = 'ready';
    }
    await saveTasksIndex(index);
  } else {
    await saveTask(task);
  }

  return { task, canRetry };
}

/**
 * 작업 완료 처리
 * @param {string} taskId
 * @param {string} summary
 */
export async function completeTask(taskId, summary) {
  const task = await loadTask(taskId);
  const now = new Date().toISOString();

  // 완료 파일 생성
  const completedTask = {
    id: task.id,
    requirement: task.requirement,
    completionCriteria: task.completionCriteria,
    maxRetries: task.maxRetries,
    totalRetries: task.currentRetry,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: now,
    summary: summary.slice(0, 300)
  };

  // 완료 파일 저장 (원자적 쓰기)
  const completedFile = path.join(getDataDir(), 'completed', `${taskId}.json`);
  await atomicWriteJson(completedFile, completedTask);

  // completed.json 인덱스 업데이트 (원자적 쓰기)
  const completedIndex = await loadCompletedIndex();
  completedIndex.tasks.push({
    id: taskId,
    file: `completed/${taskId}.json`
  });
  await atomicWriteJson(
    path.join(getDataDir(), 'completed.json'),
    completedIndex
  );

  // tasks에서 제거
  await removeFromTasks(taskId);
}

/**
 * 작업 실패 처리
 * @param {string} taskId
 * @param {string} reason
 */
export async function failTask(taskId, reason) {
  const task = await loadTask(taskId);
  const now = new Date().toISOString();

  // 실패 파일 생성
  const failedTask = {
    id: task.id,
    requirement: task.requirement,
    completionCriteria: task.completionCriteria,
    maxRetries: task.maxRetries,
    totalRetries: task.currentRetry,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    failedAt: now,
    summary: reason.slice(0, 300)
  };

  // 실패 파일 저장 (원자적 쓰기)
  const failedFile = path.join(getDataDir(), 'failed', `${taskId}.json`);
  await atomicWriteJson(failedFile, failedTask);

  // failed.json 인덱스 업데이트 (원자적 쓰기)
  const failedIndex = await loadFailedIndex();
  failedIndex.tasks.push({
    id: taskId,
    file: `failed/${taskId}.json`
  });
  await atomicWriteJson(
    path.join(getDataDir(), 'failed.json'),
    failedIndex
  );

  // tasks에서 제거
  await removeFromTasks(taskId);
}

/**
 * tasks에서 작업 제거
 * @param {string} taskId
 */
async function removeFromTasks(taskId) {
  // 인덱스에서 제거
  const index = await loadTasksIndex();
  index.tasks = index.tasks.filter(t => t.id !== taskId);
  await saveTasksIndex(index);

  // 파일 삭제
  const taskFile = path.join(getDataDir(), 'tasks', `${taskId}.json`);
  try {
    await fs.unlink(taskFile);
  } catch {
    // 파일이 없으면 무시
  }
}

/**
 * 작업 취소
 * @param {string} taskId
 */
export async function cancelTask(taskId) {
  await failTask(taskId, '사용자에 의해 취소됨');
}

/**
 * 대기/진행중인 모든 작업 가져오기
 * @returns {Promise<Task[]>}
 */
export async function getAllPendingTasks() {
  const index = await loadTasksIndex();
  const tasks = [];

  for (const item of index.tasks) {
    try {
      const task = await loadTask(item.id);
      tasks.push(task);
    } catch (err) {
      if (err.code === 'ENOENT') {
        warn('작업 파일 없음', { taskId: item.id });
      } else {
        logError('작업 로드 실패', { taskId: item.id, error: err.message });
      }
    }
  }

  return tasks;
}

/**
 * 완료된 작업 목록 가져오기
 * @returns {Promise<Array>}
 */
export async function getCompletedTasks() {
  const index = await loadCompletedIndex();
  const tasks = [];

  for (const item of index.tasks) {
    try {
      const filePath = path.join(getDataDir(), item.file);
      const content = await fs.readFile(filePath, 'utf8');
      tasks.push(JSON.parse(content));
    } catch (err) {
      if (err.code === 'ENOENT') {
        warn('완료 작업 파일 없음', { file: item.file });
      } else {
        logError('완료 작업 로드 실패', { file: item.file, error: err.message });
      }
    }
  }

  return tasks;
}

/**
 * 실패한 작업 목록 가져오기
 * @returns {Promise<Array>}
 */
export async function getFailedTasks() {
  const index = await loadFailedIndex();
  const tasks = [];

  for (const item of index.tasks) {
    try {
      const filePath = path.join(getDataDir(), item.file);
      const content = await fs.readFile(filePath, 'utf8');
      tasks.push(JSON.parse(content));
    } catch (err) {
      if (err.code === 'ENOENT') {
        warn('실패 작업 파일 없음', { file: item.file });
      } else {
        logError('실패 작업 로드 실패', { file: item.file, error: err.message });
      }
    }
  }

  return tasks;
}

/**
 * 모든 데이터 초기화 (tasks, completed, failed)
 */
export async function resetAllData() {
  const dataDir = getDataDir();

  // tasks 폴더 비우기
  const tasksDir = path.join(dataDir, 'tasks');
  try {
    const taskFiles = await fs.readdir(tasksDir);
    for (const file of taskFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(tasksDir, file));
      }
    }
  } catch {
    // 폴더가 없으면 무시
  }

  // completed 폴더 비우기
  const completedDir = path.join(dataDir, 'completed');
  try {
    const completedFiles = await fs.readdir(completedDir);
    for (const file of completedFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(completedDir, file));
      }
    }
  } catch {
    // 폴더가 없으면 무시
  }

  // failed 폴더 비우기
  const failedDir = path.join(dataDir, 'failed');
  try {
    const failedFiles = await fs.readdir(failedDir);
    for (const file of failedFiles) {
      if (file.endsWith('.json')) {
        await fs.unlink(path.join(failedDir, file));
      }
    }
  } catch {
    // 폴더가 없으면 무시
  }

  // 인덱스 파일들 초기화
  await atomicWriteJson(path.join(dataDir, 'tasks.json'), {
    lastUpdated: new Date().toISOString(),
    tasks: []
  });

  await atomicWriteJson(path.join(dataDir, 'completed.json'), {
    tasks: []
  });

  await atomicWriteJson(path.join(dataDir, 'failed.json'), {
    tasks: []
  });

  // 로그 파일 초기화
  const logFile = path.join(dataDir, 'app.log');
  try {
    await fs.writeFile(logFile, '');
  } catch {
    // 로그 파일이 없으면 무시
  }
}

/**
 * orphan 작업 정리 (inProgress 상태로 남은 작업을 ready로 리셋)
 */
export async function cleanupOrphanTasks() {
  const index = await loadTasksIndex();
  let cleaned = 0;

  for (const item of index.tasks) {
    if (item.status === 'inProgress') {
      try {
        const task = await loadTask(item.id);
        task.status = 'ready';
        task.startedAt = null;
        await saveTask(task);
        item.status = 'ready';
        cleaned++;
      } catch (err) {
        if (err.code === 'ENOENT') {
          warn('orphan 작업 파일 없음', { taskId: item.id });
        } else {
          logError('orphan 작업 정리 실패', { taskId: item.id, error: err.message });
        }
      }
    }
  }

  if (cleaned > 0) {
    await saveTasksIndex(index);
  }

  return cleaned;
}
