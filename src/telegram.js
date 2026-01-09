/**
 * 텔레그램 봇
 * 명령어 처리, 폴링, 메시지 전송
 */

import { loadConfig } from './config.js';
import {
  createTask,
  getAllPendingTasks,
  getCompletedTasks,
  getFailedTasks,
  cancelTask,
  loadTask,
  resetAllData,
  PRIORITY
} from './tasks.js';
import { info, error, debug } from './utils/logger.js';

// 우선순위 레이블
const PRIORITY_LABELS = {
  [PRIORITY.LOW]: '🔵 낮음',
  [PRIORITY.NORMAL]: '🟢 보통',
  [PRIORITY.HIGH]: '🟠 높음',
  [PRIORITY.URGENT]: '🔴 긴급'
};

let config = null;
let lastUpdateId = 0;
let isRunning = false;

// 사용자 상태 관리 (작업 생성 플로우)
const userStates = new Map();

// 최근 클로드 코드 출력 (status 명령용)
let lastClaudeOutput = [];

/**
 * 지연 함수
 * @param {number} ms
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 텔레그램 API 호출 (재시도 로직 포함)
 * @param {string} method
 * @param {object} params
 * @param {number} [maxRetries=3] - 최대 재시도 횟수
 */
async function callApi(method, params = {}, maxRetries = 3) {
  if (!config) config = await loadConfig();

  const url = `https://api.telegram.org/bot${config.botToken}/${method}`;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      if (!data.ok) {
        // 429 (Too Many Requests) - 재시도
        if (response.status === 429) {
          const retryAfter = data.parameters?.retry_after || 5;
          debug(`API 요청 제한, ${retryAfter}초 후 재시도`);
          await delay(retryAfter * 1000);
          continue;
        }
        throw new Error(`Telegram API 오류: ${data.description}`);
      }
      return data.result;
    } catch (err) {
      lastError = err;

      // 네트워크 오류인 경우 재시도
      if (attempt < maxRetries && (err.name === 'TypeError' || err.message.includes('fetch'))) {
        const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        debug(`API 호출 실패, ${backoff / 1000}초 후 재시도`, { method, attempt: attempt + 1 });
        await delay(backoff);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

/**
 * 메시지 전송
 * @param {string} text
 * @param {object} [options]
 */
export async function sendMessage(text, options = {}) {
  if (!config) config = await loadConfig();

  try {
    await callApi('sendMessage', {
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      ...options
    });
    return true;
  } catch (err) {
    error('메시지 전송 실패', err.message);
    return false;
  }
}

/**
 * 봇 명령어 설정 (자동완성용)
 */
async function setMyCommands() {
  const commands = [
    { command: 'start', description: 'chatId 확인' },
    { command: 'new', description: '새 작업 생성' },
    { command: 'list', description: '대기/진행중 작업 목록' },
    { command: 'completed', description: '완료된 작업 목록' },
    { command: 'failed', description: '실패한 작업 목록' },
    { command: 'status', description: '현재 작업 상태' },
    { command: 'debug', description: '시스템 상태' },
    { command: 'cancel', description: '작업 생성 취소' },
    { command: 'reset', description: '모든 데이터 초기화' }
  ];

  try {
    // 기존 명령어 삭제 후 새로 설정 (캐시 문제 방지)
    await callApi('deleteMyCommands', {});
    await callApi('setMyCommands', { commands });
    debug('봇 명령어 설정 완료');
  } catch (err) {
    error('봇 명령어 설정 실패', err.message);
  }
}

/**
 * 메시지 업데이트 가져오기
 */
async function getUpdates() {
  try {
    const updates = await callApi('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 10,
      allowed_updates: ['message', 'callback_query']
    });
    return updates || [];
  } catch {
    return [];
  }
}

/**
 * 명령어 처리: /start
 */
async function handleStart(chatId) {
  await sendMessage(`🤖 cc-telegram 봇입니다.\n\n당신의 chatId: <code>${chatId}</code>`);
}

/**
 * 명령어 처리: /new
 */
async function handleNew(chatId) {
  userStates.set(chatId, { step: 'requirement' });
  await sendMessage('📝 <b>새 작업 생성</b>\n\n1단계: 요구사항을 입력하세요.\n\n(/cancel로 취소)');
}

/**
 * 명령어 처리: /cancel
 */
async function handleCancel(chatId) {
  if (userStates.has(chatId)) {
    userStates.delete(chatId);
    await sendMessage('❌ 작업 생성이 취소되었습니다.');
  } else {
    await sendMessage('취소할 작업이 없습니다.');
  }
}

/**
 * 우선순위 아이콘 반환
 */
function getPriorityIcon(priority) {
  const icons = {
    [PRIORITY.LOW]: '🔵',
    [PRIORITY.NORMAL]: '🟢',
    [PRIORITY.HIGH]: '🟠',
    [PRIORITY.URGENT]: '🔴'
  };
  return icons[priority] || icons[PRIORITY.NORMAL];
}

/**
 * 명령어 처리: /list
 */
async function handleList() {
  const tasks = await getAllPendingTasks();

  if (tasks.length === 0) {
    await sendMessage('📋 대기/진행중인 작업이 없습니다.');
    return;
  }

  // 우선순위 높은 순으로 정렬
  tasks.sort((a, b) => {
    const priorityA = a.priority || PRIORITY.NORMAL;
    const priorityB = b.priority || PRIORITY.NORMAL;
    if (priorityA !== priorityB) return priorityB - priorityA;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  const keyboard = {
    inline_keyboard: tasks.map(task => [{
      text: `${task.status === 'inProgress' ? '🔄' : getPriorityIcon(task.priority || PRIORITY.NORMAL)} ${task.requirement.slice(0, 30)}...`,
      callback_data: `task_${task.id}`
    }])
  };

  await sendMessage('📋 <b>작업 목록</b>\n\n작업을 선택하면 취소할 수 있습니다.\n(🔴긴급 🟠높음 🟢보통 🔵낮음)', {
    reply_markup: keyboard
  });
}

/**
 * 명령어 처리: /completed
 */
async function handleCompleted() {
  const tasks = await getCompletedTasks();

  if (tasks.length === 0) {
    await sendMessage('✅ 완료된 작업이 없습니다.');
    return;
  }

  let text = '✅ <b>완료된 작업</b>\n\n';
  for (const task of tasks.slice(-10)) {
    const date = new Date(task.completedAt).toLocaleDateString('ko-KR');
    text += `• ${task.requirement.slice(0, 40)}...\n  └ ${date} (${task.totalRetries}회 시도)\n\n`;
  }

  if (tasks.length > 10) {
    text += `\n... 외 ${tasks.length - 10}개`;
  }

  await sendMessage(text);
}

/**
 * 명령어 처리: /failed
 */
async function handleFailed() {
  const tasks = await getFailedTasks();

  if (tasks.length === 0) {
    await sendMessage('❌ 실패한 작업이 없습니다.');
    return;
  }

  let text = '❌ <b>실패한 작업</b>\n\n';
  for (const task of tasks.slice(-10)) {
    const date = new Date(task.failedAt).toLocaleDateString('ko-KR');
    text += `• ${task.requirement.slice(0, 40)}...\n  └ ${date}: ${task.summary.slice(0, 50)}...\n\n`;
  }

  if (tasks.length > 10) {
    text += `\n... 외 ${tasks.length - 10}개`;
  }

  await sendMessage(text);
}

/**
 * 명령어 처리: /status
 */
async function handleStatus() {
  const tasks = await getAllPendingTasks();
  const inProgress = tasks.find(t => t.status === 'inProgress');

  let text = '📊 <b>현재 상태</b>\n\n';

  if (inProgress) {
    text += `🔄 진행중: ${inProgress.requirement.slice(0, 50)}...\n`;
    text += `   시도: ${inProgress.currentRetry + 1}/${inProgress.maxRetries}\n\n`;
  } else {
    text += '현재 진행중인 작업 없음\n\n';
  }

  text += `⏳ 대기중: ${tasks.filter(t => t.status === 'ready').length}개\n`;

  if (lastClaudeOutput.length > 0) {
    text += '\n<b>최근 출력:</b>\n<code>';
    text += lastClaudeOutput.slice(-5).join('\n');
    text += '</code>';
  }

  await sendMessage(text);
}

/**
 * 명령어 처리: /reset
 */
async function handleReset() {
  await sendMessage(
    '⚠️ <b>데이터 초기화</b>\n\n' +
    '모든 작업 대기/완료/실패 내역과 로그가 모두 사라집니다.\n' +
    '계속 진행하시겠습니까?',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '예', callback_data: 'reset_yes' },
          { text: '아니오', callback_data: 'reset_no' }
        ]]
      }
    }
  );
}

/**
 * 명령어 처리: /debug
 */
async function handleDebug() {
  const tasks = await getAllPendingTasks();
  const completed = await getCompletedTasks();
  const failed = await getFailedTasks();

  const memUsage = process.memoryUsage();

  let text = '🔧 <b>시스템 상태</b>\n\n';
  text += `📋 대기중: ${tasks.filter(t => t.status === 'ready').length}개\n`;
  text += `🔄 진행중: ${tasks.filter(t => t.status === 'inProgress').length}개\n`;
  text += `✅ 완료: ${completed.length}개\n`;
  text += `❌ 실패: ${failed.length}개\n\n`;
  text += `💾 메모리: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n`;
  text += `⏰ 가동시간: ${Math.round(process.uptime() / 60)}분\n`;

  await sendMessage(text);
}

/**
 * 작업 생성 플로우 처리
 */
async function handleNewTaskFlow(chatId, text) {
  const state = userStates.get(chatId);
  if (!state) return false;

  if (state.step === 'requirement') {
    state.requirement = text;
    state.step = 'criteria';
    userStates.set(chatId, state);
    await sendMessage('2단계: 완료 기준을 입력하세요.\n\n(예: "테스트가 모두 통과하고 빌드 성공")');
    return true;
  }

  if (state.step === 'criteria') {
    state.criteria = text;
    state.step = 'priority';
    userStates.set(chatId, state);

    await sendMessage('3단계: 우선순위를 선택하세요.', {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔵 낮음', callback_data: 'priority_1' },
            { text: '🟢 보통', callback_data: 'priority_2' }
          ],
          [
            { text: '🟠 높음', callback_data: 'priority_3' },
            { text: '🔴 긴급', callback_data: 'priority_4' }
          ]
        ]
      }
    });
    return true;
  }

  if (state.step === 'retries_custom') {
    const retries = parseInt(text, 10);
    if (isNaN(retries) || retries < 1 || retries > 100) {
      await sendMessage('1~100 사이의 숫자를 입력하세요.');
      return true;
    }

    await finishTaskCreation(chatId, state, retries);
    return true;
  }

  return false;
}

/**
 * 작업 생성 완료
 */
async function finishTaskCreation(chatId, state, retries) {
  const task = await createTask({
    requirement: state.requirement,
    completionCriteria: state.criteria,
    maxRetries: retries,
    workingDirectory: process.cwd(),
    priority: state.priority || PRIORITY.NORMAL
  });

  userStates.delete(chatId);

  const priorityLabel = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[PRIORITY.NORMAL];

  await sendMessage(
    `✅ <b>작업이 등록되었습니다!</b>\n\n` +
    `📝 요구사항: ${state.requirement.slice(0, 100)}...\n` +
    `🎯 완료기준: ${state.criteria.slice(0, 100)}...\n` +
    `⚡ 우선순위: ${priorityLabel}\n` +
    `🔄 반복횟수: ${retries}회`
  );

  info('새 작업 생성', { taskId: task.id, priority: task.priority });
}

/**
 * 콜백 쿼리 처리 (인라인 버튼)
 */
async function handleCallbackQuery(query) {
  const chatId = query.message?.chat?.id?.toString();
  const data = query.data;

  // 유효성 검사
  if (!chatId || !data) {
    return;
  }

  // 콜백 응답 (로딩 표시 제거)
  try {
    await callApi('answerCallbackQuery', { callback_query_id: query.id });
  } catch (err) {
    error('answerCallbackQuery 실패', err.message);
  }

  // 우선순위 선택
  if (data.startsWith('priority_')) {
    const state = userStates.get(chatId);
    if (state && state.step === 'priority') {
      const priority = parseInt(data.replace('priority_', ''), 10);
      state.priority = priority;
      state.step = 'retries';
      userStates.set(chatId, state);

      await sendMessage('4단계: 반복 횟수를 선택하세요.', {
        reply_markup: {
          inline_keyboard: [
            [
              { text: '10회 실행', callback_data: 'retry_10' },
              { text: '직접 입력', callback_data: 'retry_custom' }
            ]
          ]
        }
      });
    } else {
      await sendMessage('⚠️ 작업 생성 세션이 만료되었습니다. /new로 다시 시작해주세요.');
    }
    return;
  }

  // 반복 횟수 선택
  if (data === 'retry_10') {
    const state = userStates.get(chatId);
    if (state && state.step === 'retries') {
      await finishTaskCreation(chatId, state, 10);
    } else {
      await sendMessage('⚠️ 작업 생성 세션이 만료되었습니다. /new로 다시 시작해주세요.');
    }
    return;
  }

  if (data === 'retry_custom') {
    const state = userStates.get(chatId);
    if (state && state.step === 'retries') {
      state.step = 'retries_custom';
      userStates.set(chatId, state);
      await sendMessage('반복 횟수를 입력하세요 (1~100):');
    } else {
      await sendMessage('⚠️ 작업 생성 세션이 만료되었습니다. /new로 다시 시작해주세요.');
    }
    return;
  }

  // 작업 선택
  if (data.startsWith('task_')) {
    const taskId = data.replace('task_', '');
    try {
      const task = await loadTask(taskId);
      const priorityLabel = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[PRIORITY.NORMAL];
      await sendMessage(
        `📝 <b>${task.requirement.slice(0, 50)}...</b>\n\n` +
        `상태: ${task.status === 'inProgress' ? '🔄 진행중' : '⏳ 대기중'}\n` +
        `우선순위: ${priorityLabel}\n` +
        `시도: ${task.currentRetry}/${task.maxRetries}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🗑️ 작업 취소', callback_data: `cancel_${taskId}` }
            ]]
          }
        }
      );
    } catch {
      await sendMessage('작업을 찾을 수 없습니다.');
    }
    return;
  }

  // 작업 취소
  if (data.startsWith('cancel_')) {
    const taskId = data.replace('cancel_', '');
    try {
      await cancelTask(taskId);
      await sendMessage('✅ 작업이 취소되었습니다.');
      info('작업 취소', { taskId });
    } catch {
      await sendMessage('작업 취소에 실패했습니다.');
    }
    return;
  }

  // 데이터 초기화 - 예
  if (data === 'reset_yes') {
    try {
      await resetAllData();
      await sendMessage('✅ 모든 데이터가 초기화되었습니다.');
      info('데이터 초기화 완료');
    } catch (err) {
      await sendMessage('❌ 초기화 중 오류가 발생했습니다.');
      error('데이터 초기화 실패', err.message);
    }
    return;
  }

  // 데이터 초기화 - 아니오
  if (data === 'reset_no') {
    await sendMessage('취소되었습니다.');
    return;
  }
}

/**
 * 메시지 처리
 */
async function handleMessage(message) {
  if (!config) config = await loadConfig();

  const chatId = message.chat.id.toString();
  const text = message.text || '';

  // chatId 검증
  if (chatId !== config.chatId) {
    debug('허용되지 않은 chatId', { chatId });
    return;
  }

  // 명령어 처리
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase();

    switch (command) {
      case '/start':
        await handleStart(chatId);
        break;
      case '/new':
        await handleNew(chatId);
        break;
      case '/cancel':
        await handleCancel(chatId);
        break;
      case '/list':
        await handleList();
        break;
      case '/completed':
        await handleCompleted();
        break;
      case '/failed':
        await handleFailed();
        break;
      case '/status':
        await handleStatus();
        break;
      case '/debug':
        await handleDebug();
        break;
      case '/reset':
        await handleReset();
        break;
      default:
        await sendMessage('알 수 없는 명령어입니다. /start로 시작하세요.');
    }
    return;
  }

  // 작업 생성 플로우 처리
  const handled = await handleNewTaskFlow(chatId, text);
  if (!handled) {
    await sendMessage('명령어를 입력하세요. /new로 새 작업을 생성할 수 있습니다.');
  }
}

/**
 * 업데이트 처리
 */
async function processUpdate(update) {
  lastUpdateId = update.update_id;

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message && update.message.text) {
      await handleMessage(update.message);
    }
  } catch (err) {
    error('업데이트 처리 오류', err.message);
  }
}

/**
 * 폴링 루프
 */
async function pollLoop() {
  while (isRunning) {
    try {
      const updates = await getUpdates();
      for (const update of updates) {
        await processUpdate(update);
      }
    } catch (err) {
      error('폴링 오류', err.message);
    }

    // 짧은 대기
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * 텔레그램 봇 시작
 */
export async function startBot() {
  if (isRunning) return;

  config = await loadConfig();
  isRunning = true;

  await setMyCommands();
  info('텔레그램 봇 시작');
  await sendMessage('🤖 cc-telegram 봇이 시작되었습니다.');

  // 백그라운드 폴링 시작
  pollLoop().catch(err => {
    error('폴링 루프 오류', err.message);
  });
}

/**
 * 텔레그램 봇 중지
 */
export function stopBot() {
  isRunning = false;
  info('텔레그램 봇 중지');
}

/**
 * 클로드 출력 업데이트 (status 명령용)
 * @param {string} line
 */
export function updateClaudeOutput(line) {
  lastClaudeOutput.push(line);
  if (lastClaudeOutput.length > 20) {
    lastClaudeOutput.shift();
  }
}

/**
 * 클로드 출력 초기화
 */
export function clearClaudeOutput() {
  lastClaudeOutput = [];
}
