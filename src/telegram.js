/**
 * 텔레그램 봇
 * 명령어 처리, 폴링, 메시지 전송
 */

import os from 'os';
import { loadConfig } from './config.js';
import {
  createTask,
  getAllPendingTasks,
  getCompletedTasks,
  getFailedTasks,
  cancelTask,
  loadTask,
  resetAllData,
  PRIORITY,
  failTask
} from './tasks.js';
import { cancelRunningTask, isTaskRunning } from './executor.js';
import { info, error, debug } from './utils/logger.js';
import { t, getCurrentLanguage } from './i18n.js';

// 우선순위 레이블 (동적 생성)
function getPriorityLabels() {
  return {
    [PRIORITY.LOW]: `🔵 ${t('telegram.priority_low')}`,
    [PRIORITY.NORMAL]: `🟢 ${t('telegram.priority_normal')}`,
    [PRIORITY.HIGH]: `🟠 ${t('telegram.priority_high')}`,
    [PRIORITY.URGENT]: `🔴 ${t('telegram.priority_urgent')}`
  };
}

let config = null;
let lastUpdateId = 0;
let isRunning = false;

// 사용자 상태 관리 (작업 생성 플로우)
const userStates = new Map();

// 최근 클로드 코드 출력 (status 명령용) - taskId별 관리
const lastClaudeOutputs = new Map();

/**
 * 지연 함수
 * @param {number} ms
 */
/* istanbul ignore next */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 텔레그램 API 호출 (재시도 로직 포함)
 * @param {string} method
 * @param {object} params
 * @param {number} [maxRetries=3] - 최대 재시도 횟수
 */
/* istanbul ignore next */
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
          debug(`API rate limited, retry after ${retryAfter}s`);
          await delay(retryAfter * 1000);
          continue;
        }
        throw new Error(`Telegram API error: ${data.description}`);
      }
      return data.result;
    } catch (err) {
      lastError = err;

      // 네트워크 오류인 경우 재시도
      if (attempt < maxRetries && (err.name === 'TypeError' || err.message.includes('fetch'))) {
        const backoff = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        debug(`API call failed, retry after ${backoff / 1000}s`, { method, attempt: attempt + 1 });
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
    error('Message send failed', err.message);
    return false;
  }
}

/**
 * 봇 명령어 설정 (자동완성용)
 */
/* istanbul ignore next */
async function setMyCommands() {
  const commands = [
    { command: 'start', description: t('telegram.cmd_start') },
    { command: 'new', description: t('telegram.cmd_new') },
    { command: 'list', description: t('telegram.cmd_list') },
    { command: 'completed', description: t('telegram.cmd_completed') },
    { command: 'failed', description: t('telegram.cmd_failed') },
    { command: 'status', description: t('telegram.cmd_status') },
    { command: 'debug', description: t('telegram.cmd_debug') },
    { command: 'cancel', description: t('telegram.cmd_cancel') },
    { command: 'reset', description: t('telegram.cmd_reset') }
  ];

  try {
    // 기존 명령어 삭제 후 새로 설정 (캐시 문제 방지)
    await callApi('deleteMyCommands', {});
    await callApi('setMyCommands', { commands });
    debug('Bot commands set');
  } catch (err) {
    error('Failed to set bot commands', err.message);
  }
}

/**
 * 메시지 업데이트 가져오기
 */
/* istanbul ignore next */
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
/* istanbul ignore next */
async function handleStart(chatId) {
  await sendMessage(`🤖 ${t('telegram.bot_greeting', { chatId })}`);
}

/**
 * 명령어 처리: /new
 */
/* istanbul ignore next */
async function handleNew(chatId) {
  userStates.set(chatId, { step: 'complexity' });
  await sendMessage(`📝 <b>${t('telegram.new_task_title')}</b>\n\n${t('telegram.select_complexity')}\n\n${t('telegram.cancel_hint')}`, {
    reply_markup: {
      inline_keyboard: [[
        { text: t('telegram.complexity_simple'), callback_data: 'complexity_simple' },
        { text: t('telegram.complexity_complex'), callback_data: 'complexity_complex' }
      ]]
    }
  });
}

/**
 * 명령어 처리: /cancel
 */
/* istanbul ignore next */
async function handleCancel(chatId) {
  if (userStates.has(chatId)) {
    userStates.delete(chatId);
    await sendMessage(`❌ ${t('telegram.task_cancelled')}`);
  } else {
    await sendMessage(t('telegram.no_task_to_cancel'));
  }
}

/**
 * 우선순위 아이콘 반환
 */
/* istanbul ignore next */
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
/* istanbul ignore next */
async function handleList() {
  const tasks = await getAllPendingTasks();

  if (tasks.length === 0) {
    await sendMessage(`📋 ${t('telegram.no_pending_tasks')}`);
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

  await sendMessage(`📋 <b>${t('telegram.task_list_title')}</b>\n\n${t('telegram.task_list_hint')}\n${t('telegram.priority_legend')}`, {
    reply_markup: keyboard
  });
}

/**
 * 명령어 처리: /completed
 */
/* istanbul ignore next */
async function handleCompleted() {
  const tasks = await getCompletedTasks();

  if (tasks.length === 0) {
    await sendMessage(`✅ ${t('telegram.no_completed_tasks')}`);
    return;
  }

  const lang = getCurrentLanguage();
  let text = `✅ <b>${t('telegram.completed_tasks_title')}</b>\n\n`;
  for (const task of tasks.slice(-10)) {
    const date = new Date(task.completedAt).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang);
    text += `${t('telegram.task_item', { requirement: task.requirement.slice(0, 40), date, retries: task.totalRetries })}\n\n`;
  }

  if (tasks.length > 10) {
    text += `\n${t('telegram.more_tasks', { count: tasks.length - 10 })}`;
  }

  await sendMessage(text);
}

/**
 * 명령어 처리: /failed
 */
/* istanbul ignore next */
async function handleFailed() {
  const tasks = await getFailedTasks();

  if (tasks.length === 0) {
    await sendMessage(`❌ ${t('telegram.no_failed_tasks')}`);
    return;
  }

  const lang = getCurrentLanguage();
  let text = `❌ <b>${t('telegram.failed_tasks_title')}</b>\n\n`;
  for (const task of tasks.slice(-10)) {
    const date = new Date(task.failedAt).toLocaleDateString(lang === 'ko' ? 'ko-KR' : lang);
    text += `${t('telegram.failed_task_item', { requirement: task.requirement.slice(0, 40), date, summary: task.summary.slice(0, 50) })}\n\n`;
  }

  if (tasks.length > 10) {
    text += `\n${t('telegram.more_tasks', { count: tasks.length - 10 })}`;
  }

  await sendMessage(text);
}

/**
 * 명령어 처리: /status
 */
/* istanbul ignore next */
async function handleStatus() {
  const tasks = await getAllPendingTasks();
  const inProgressTasks = tasks.filter(t => t.status === 'inProgress');

  let text = `📊 <b>${t('telegram.current_status_title')}</b>\n\n`;

  if (inProgressTasks.length > 0) {
    text += `🔄 ${t('telegram.in_progress_count', { count: inProgressTasks.length })}\n`;
    for (const task of inProgressTasks) {
      const shortId = task.id.slice(-8);
      text += `  ${t('telegram.task_progress', { id: shortId, requirement: task.requirement.slice(0, 40), current: task.currentRetry + 1, max: task.maxRetries })}\n`;
    }
    text += '\n';
  } else {
    text += `${t('telegram.no_in_progress')}\n\n`;
  }

  text += `⏳ ${t('telegram.waiting_count', { count: tasks.filter(t => t.status === 'ready').length })}\n`;

  // 실행 중인 작업들의 최근 출력 표시
  if (inProgressTasks.length > 0 && lastClaudeOutputs.size > 0) {
    text += `\n<b>${t('telegram.recent_output')}</b>\n`;
    for (const task of inProgressTasks) {
      const outputs = lastClaudeOutputs.get(task.id);
      if (outputs && outputs.length > 0) {
        const shortId = task.id.slice(-8);
        text += `\n[${shortId}]\n<code>`;
        text += outputs.slice(-3).join('\n');
        text += '</code>\n';
      }
    }
  }

  // 실행 중인 작업별 취소 버튼 추가
  if (inProgressTasks.length > 0) {
    const keyboard = {
      inline_keyboard: inProgressTasks.map(task => [{
        text: `🛑 ${t('telegram.stop_running_task_btn', { id: task.id.slice(-8) })}`,
        callback_data: `stop_${task.id}`
      }])
    };
    await sendMessage(text, { reply_markup: keyboard });
  } else {
    await sendMessage(text);
  }
}

/**
 * 명령어 처리: /reset
 */
/* istanbul ignore next */
async function handleReset() {
  await sendMessage(
    `⚠️ <b>${t('telegram.reset_title')}</b>\n\n${t('telegram.reset_warning')}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: t('telegram.yes'), callback_data: 'reset_yes' },
          { text: t('telegram.no'), callback_data: 'reset_no' }
        ]]
      }
    }
  );
}

/**
 * 명령어 처리: /debug
 */
/* istanbul ignore next */
async function handleDebug() {
  const tasks = await getAllPendingTasks();
  const completed = await getCompletedTasks();
  const failed = await getFailedTasks();

  const memUsage = process.memoryUsage();

  let text = `🔧 <b>${t('telegram.system_status_title')}</b>\n\n`;
  text += `📋 ${t('telegram.waiting_count', { count: tasks.filter(t => t.status === 'ready').length })}\n`;
  text += `🔄 ${t('telegram.in_progress_count', { count: tasks.filter(t => t.status === 'inProgress').length })}\n`;
  text += `✅ ${t('telegram.completed_tasks_title')}: ${completed.length}\n`;
  text += `❌ ${t('telegram.failed_tasks_title')}: ${failed.length}\n\n`;
  text += `💾 ${t('telegram.memory_usage', { usage: Math.round(memUsage.heapUsed / 1024 / 1024) })}\n`;
  text += `⏰ ${t('telegram.uptime', { minutes: Math.round(process.uptime() / 60) })}\n`;

  await sendMessage(text);
}

/**
 * 작업 생성 플로우 처리
 */
/* istanbul ignore next */
async function handleNewTaskFlow(chatId, text) {
  const state = userStates.get(chatId);
  if (!state) return false;

  // 단순 요청: 요구사항만 입력하면 바로 접수
  if (state.step === 'simple_requirement') {
    state.requirement = text;
    await finishSimpleTaskCreation(chatId, state);
    return true;
  }

  if (state.step === 'requirement') {
    state.requirement = text;
    state.step = 'criteria';
    userStates.set(chatId, state);
    await sendMessage(t('telegram.step2_criteria'));
    return true;
  }

  if (state.step === 'criteria') {
    state.criteria = text;
    state.step = 'priority';
    userStates.set(chatId, state);

    await sendMessage(t('telegram.step3_priority'), {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `🔵 ${t('telegram.priority_low')}`, callback_data: 'priority_1' },
            { text: `🟢 ${t('telegram.priority_normal')}`, callback_data: 'priority_2' }
          ],
          [
            { text: `🟠 ${t('telegram.priority_high')}`, callback_data: 'priority_3' },
            { text: `🔴 ${t('telegram.priority_urgent')}`, callback_data: 'priority_4' }
          ]
        ]
      }
    });
    return true;
  }

  if (state.step === 'retries_custom') {
    const retries = parseInt(text, 10);
    if (isNaN(retries) || retries < 1 || retries > 100) {
      await sendMessage(t('telegram.invalid_retries'));
      return true;
    }

    await finishTaskCreation(chatId, state, retries);
    return true;
  }

  return false;
}

/**
 * 단순 작업 생성 완료
 */
/* istanbul ignore next */
async function finishSimpleTaskCreation(chatId, state) {
  const task = await createTask({
    requirement: state.requirement,
    completionCriteria: null, // 완료 조건 없음
    maxRetries: 1, // 반복 없음
    workingDirectory: process.cwd(),
    priority: PRIORITY.NORMAL
  });

  userStates.delete(chatId);

  await sendMessage(
    `✅ <b>${t('telegram.task_registered')}</b>\n\n` +
    `📝 ${t('telegram.requirement_label', { text: state.requirement.slice(0, 100) })}...\n` +
    `⚡ ${t('telegram.type_simple')}`
  );

  info('New simple task created', { taskId: task.id });
}

/**
 * 작업 생성 완료
 */
/* istanbul ignore next */
async function finishTaskCreation(chatId, state, retries) {
  const task = await createTask({
    requirement: state.requirement,
    completionCriteria: state.criteria,
    maxRetries: retries,
    workingDirectory: process.cwd(),
    priority: state.priority || PRIORITY.NORMAL
  });

  userStates.delete(chatId);

  const priorityLabels = getPriorityLabels();
  const priorityLabel = priorityLabels[task.priority] || priorityLabels[PRIORITY.NORMAL];

  await sendMessage(
    `✅ <b>${t('telegram.task_registered')}</b>\n\n` +
    `📝 ${t('telegram.requirement_label', { text: state.requirement.slice(0, 100) })}...\n` +
    `🎯 ${t('telegram.criteria_label', { text: state.criteria.slice(0, 100) })}...\n` +
    `⚡ ${t('telegram.priority_label', { priority: priorityLabel })}\n` +
    `🔄 ${t('telegram.retries_label', { count: retries })}`
  );

  info('New task created', { taskId: task.id, priority: task.priority });
}

/**
 * 콜백 쿼리 처리 (인라인 버튼)
 */
/* istanbul ignore next */
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
    error('answerCallbackQuery failed', err.message);
  }

  // 복잡도 선택 - 단순
  if (data === 'complexity_simple') {
    const state = userStates.get(chatId);
    if (state && state.step === 'complexity') {
      state.step = 'simple_requirement';
      state.isSimple = true;
      userStates.set(chatId, state);
      await sendMessage(t('telegram.step_requirement'));
    } else {
      await sendMessage(`⚠️ ${t('telegram.session_expired')}`);
    }
    return;
  }

  // 복잡도 선택 - 복잡
  if (data === 'complexity_complex') {
    const state = userStates.get(chatId);
    if (state && state.step === 'complexity') {
      state.step = 'requirement';
      state.isSimple = false;
      userStates.set(chatId, state);
      await sendMessage(t('telegram.step1_requirement'));
    } else {
      await sendMessage(`⚠️ ${t('telegram.session_expired')}`);
    }
    return;
  }

  // 우선순위 선택
  if (data.startsWith('priority_')) {
    const state = userStates.get(chatId);
    if (state && state.step === 'priority') {
      const priority = parseInt(data.replace('priority_', ''), 10);
      state.priority = priority;
      state.step = 'retries';
      userStates.set(chatId, state);

      const defaultRetries = config?.defaultMaxRetries || 15;
      await sendMessage(t('telegram.step4_retries'), {
        reply_markup: {
          inline_keyboard: [
            [
              { text: `${defaultRetries}${t('telegram.retries_unit')}`, callback_data: 'retry_default' },
              { text: t('telegram.retries_custom'), callback_data: 'retry_custom' }
            ]
          ]
        }
      });
    } else {
      await sendMessage(`⚠️ ${t('telegram.session_expired')}`);
    }
    return;
  }

  // 반복 횟수 선택 - 기본값
  if (data === 'retry_default') {
    const state = userStates.get(chatId);
    if (state && state.step === 'retries') {
      const defaultRetries = config?.defaultMaxRetries || 15;
      await finishTaskCreation(chatId, state, defaultRetries);
    } else {
      await sendMessage(`⚠️ ${t('telegram.session_expired')}`);
    }
    return;
  }

  if (data === 'retry_custom') {
    const state = userStates.get(chatId);
    if (state && state.step === 'retries') {
      state.step = 'retries_custom';
      userStates.set(chatId, state);
      await sendMessage(t('telegram.enter_retries'));
    } else {
      await sendMessage(`⚠️ ${t('telegram.session_expired')}`);
    }
    return;
  }

  // 작업 선택
  if (data.startsWith('task_')) {
    const taskId = data.replace('task_', '');
    try {
      const task = await loadTask(taskId);
      const priorityLabels = getPriorityLabels();
      const priorityLabel = priorityLabels[task.priority] || priorityLabels[PRIORITY.NORMAL];
      const statusText = task.status === 'inProgress' ? `🔄 ${t('telegram.task_detail_status_inprogress')}` : `⏳ ${t('telegram.task_detail_status_waiting')}`;
      await sendMessage(
        `📝 <b>${task.requirement.slice(0, 50)}...</b>\n\n` +
        `${t('telegram.status_label', { status: statusText })}\n` +
        `${t('telegram.priority_label', { priority: priorityLabel })}\n` +
        `${t('telegram.tries_label', { current: task.currentRetry, max: task.maxRetries })}`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: `🗑️ ${t('telegram.cancel_task_btn')}`, callback_data: `cancel_${taskId}` }
            ]]
          }
        }
      );
    } catch {
      await sendMessage(t('telegram.task_not_found'));
    }
    return;
  }

  // 작업 취소 (대기 중인 작업)
  if (data.startsWith('cancel_')) {
    const taskId = data.replace('cancel_', '');
    try {
      await cancelTask(taskId);
      await sendMessage(`✅ ${t('telegram.task_cancel_success')}`);
      info('Task cancelled', { taskId });
    } catch {
      await sendMessage(t('telegram.task_cancel_failed'));
    }
    return;
  }

  // 실행 중인 작업 중지
  if (data.startsWith('stop_')) {
    const taskId = data.replace('stop_', '');
    try {
      // 실행 중인 프로세스 종료
      const stopped = cancelRunningTask(taskId);
      if (stopped) {
        // 작업을 실패로 처리
        await failTask(taskId, t('tasks.cancelled_by_user'));
        await sendMessage(`🛑 ${t('telegram.running_task_stopped')}`);
        info('Running task stopped', { taskId });
      } else {
        // 프로세스가 없으면 일반 취소 시도
        await cancelTask(taskId);
        await sendMessage(`✅ ${t('telegram.task_cancel_success')}`);
        info('Task cancelled (not running)', { taskId });
      }
    } catch (err) {
      error('Failed to stop running task', { taskId, error: err.message });
      await sendMessage(t('telegram.stop_running_task_failed'));
    }
    return;
  }

  // 데이터 초기화 - 예
  if (data === 'reset_yes') {
    try {
      await resetAllData();
      await sendMessage(`✅ ${t('telegram.reset_success')}`);
      info('Data reset complete');
    } catch (err) {
      await sendMessage(`❌ ${t('telegram.reset_failed')}`);
      error('Data reset failed', err.message);
    }
    return;
  }

  // 데이터 초기화 - 아니오
  if (data === 'reset_no') {
    await sendMessage(t('telegram.reset_cancelled'));
    return;
  }
}

/**
 * 메시지 처리
 */
/* istanbul ignore next */
async function handleMessage(message) {
  if (!config) config = await loadConfig();

  const chatId = message.chat.id.toString();
  const text = message.text || '';

  // chatId 검증
  if (chatId !== config.chatId) {
    debug('Unauthorized chatId', { chatId });
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
        await sendMessage(t('telegram.unknown_command'));
    }
    return;
  }

  // 작업 생성 플로우 처리
  const handled = await handleNewTaskFlow(chatId, text);
  if (!handled) {
    await sendMessage(t('telegram.enter_command'));
  }
}

/**
 * 업데이트 처리
 */
/* istanbul ignore next */
async function processUpdate(update) {
  lastUpdateId = update.update_id;

  try {
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.message && update.message.text) {
      await handleMessage(update.message);
    }
  } catch (err) {
    error('Update processing error', err.message);
  }
}

/**
 * 폴링 루프
 */
/* istanbul ignore next */
async function pollLoop() {
  while (isRunning) {
    try {
      const updates = await getUpdates();
      for (const update of updates) {
        await processUpdate(update);
      }
    } catch (err) {
      error('Polling error', err.message);
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
  info('Telegram bot started');

  const hostname = os.hostname();
  const workingDir = process.cwd();
  await sendMessage(`🤖 ${t('telegram.bot_started', { hostname, workingDir })}`);

  // 백그라운드 폴링 시작
  /* istanbul ignore next */
  pollLoop().catch(err => {
    error('Polling loop error', err.message);
  });
}

/**
 * 텔레그램 봇 중지
 */
export function stopBot() {
  isRunning = false;
  info('Telegram bot stopped');
}

/**
 * 클로드 출력 업데이트 (status 명령용)
 * @param {string} line
 * @param {string} taskId
 */
export function updateClaudeOutput(line, taskId) {
  if (!taskId) return;

  if (!lastClaudeOutputs.has(taskId)) {
    lastClaudeOutputs.set(taskId, []);
  }

  const outputs = lastClaudeOutputs.get(taskId);
  outputs.push(line);

  // 각 작업당 최대 20줄 유지
  if (outputs.length > 20) {
    outputs.shift();
  }
}

/**
 * 클로드 출력 초기화
 * @param {string} taskId
 */
export function clearClaudeOutput(taskId) {
  if (taskId) {
    lastClaudeOutputs.delete(taskId);
  } else {
    lastClaudeOutputs.clear();
  }
}

// 테스트용 export
export const _test = {
  getUserState: (chatId) => userStates.get(chatId),
  setUserState: (chatId, state) => userStates.set(chatId, state),
  deleteUserState: (chatId) => userStates.delete(chatId),
  clearUserStates: () => userStates.clear()
};
