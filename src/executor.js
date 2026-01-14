/**
 * 클로드 코드 실행기
 * Ralph Wiggum 방식 반복 실행 (순차/병렬 지원)
 */

import { spawn, execSync } from 'child_process';
import {
  getNextTask,
  getNextTasks,
  startTask,
  incrementRetry,
  completeTask,
  failTask
} from './tasks.js';
import { loadConfig } from './config.js';
import { sendMessage, sendLongMessage, updateClaudeOutput, clearClaudeOutput } from './telegram.js';
import { info, error, debug } from './utils/logger.js';
import { t } from './i18n.js';

let isRunning = false;
let cachedClaudeCommand = null;

// 병렬 실행 시 현재 실행 중인 작업들
const runningTasks = new Map();

// 실행 중인 프로세스 저장 (취소용)
const runningProcesses = new Map();

/**
 * HTML 이스케이프 (Telegram HTML 파싱 오류 방지)
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Claude 실행 명령어 가져오기
 * config에서 설정된 값이 있으면 사용, 없으면 자동 감지
 * @returns {Promise<{command: string, args: string[], useShell: boolean}>}
 */
/* istanbul ignore next */
async function getClaudeCommand() {
  const config = await loadConfig();

  let command, args, useShell;

  if (config.claudeCommand) {
    // 사용자 지정 명령어 사용
    const parts = config.claudeCommand.split(' ');
    command = parts[0];
    args = [...parts.slice(1), '--dangerously-skip-permissions'];
    useShell = true;
  } else {
    // 자동 감지
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      command = 'claude.cmd';
      args = ['--dangerously-skip-permissions'];
      useShell = true;
    } else {
      command = 'claude';
      args = ['--dangerously-skip-permissions'];
      useShell = false;
    }
  }

  return { command, args, useShell };
}

/**
 * 클로드 코드 실행
 * @param {string} prompt
 * @param {string} cwd
 * @param {string} taskId - 작업 ID (병렬 실행 시 구분용)
 * @param {boolean} isParallel - 병렬 실행 여부
 * @returns {Promise<{exitCode: number, output: string}>}
 */
/* istanbul ignore next */
async function runClaude(prompt, cwd, taskId, isParallel = false) {
  const config = await loadConfig();
  const { command, args, useShell } = await getClaudeCommand();
  const timeoutMinutes = config.taskTimeout || 30;

  return new Promise((resolve, reject) => {
    const spawnOptions = {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe']
    };

    let proc;
    if (useShell) {
      // shell: true일 때는 command와 args를 합쳐서 전달 (보안 경고 방지)
      const fullCommand = [command, ...args].join(' ');
      spawnOptions.shell = true;
      if (process.platform === 'win32') {
        spawnOptions.windowsHide = true;
      }
      proc = spawn(fullCommand, [], spawnOptions);
    } else {
      proc = spawn(command, args, spawnOptions);
    }

    let output = '';
    const shortId = taskId.slice(-8);

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (isParallel) {
        // 병렬 실행 시 작업 ID 프리픽스 추가
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            process.stdout.write(`[${shortId}] ${line}\n`);
          }
        });
      } else {
        // 순차 실행 시 그대로 출력
        process.stdout.write(text);
      }

      // 텔레그램에도 실시간 출력 업데이트
      text.split('\n').forEach(line => {
        if (line.trim()) {
          updateClaudeOutput(line.trim(), taskId);
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;

      if (isParallel) {
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim()) {
            process.stderr.write(`[${shortId}] ${line}\n`);
          }
        });
      } else {
        process.stderr.write(text);
      }
    });

    // 프롬프트 전송
    proc.stdin.write(prompt);
    proc.stdin.end();

    // 타임아웃 (config에서 설정, 기본 30분)
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(t('executor.timeout_error', { minutes: timeoutMinutes })));
    }, timeoutMinutes * 60 * 1000);

    // 프로세스 저장 (취소용)
    runningProcesses.set(taskId, proc);

    proc.on('close', (exitCode) => {
      clearTimeout(timeout);
      runningProcesses.delete(taskId);
      resolve({ exitCode: exitCode || 0, output });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      runningProcesses.delete(taskId);
      reject(err);
    });
  });
}

// 완료 신호 상수
const COMPLETION_SIGNAL = '<promise>COMPLETE</promise>';
const FAILURE_SIGNAL = '<promise>FAILED</promise>';

/**
 * 프롬프트 생성
 * @param {object} task
 * @returns {string}
 */
function buildPrompt(task) {
  const isComplex = task.complexity === 'complex';

  let prompt = `# ${t('prompt.title')}

## ${t('prompt.requirement')}
${task.requirement}

## ${t('prompt.completion_criteria')}
${task.completionCriteria || t('prompt.none')}

## ${t('prompt.instructions_title')}
- ${t('prompt.instruction1')}
- ${t('prompt.instruction2')}
- ${t('prompt.instruction3')}`;

  // 복잡 작업일 때 plan 모드 관련 지시 추가
  if (isComplex) {
    prompt += `\n- ${t('prompt.plan_instruction')}`;
  }

  prompt += `

## ${t('prompt.signal_title')}
- ${t('prompt.signal_complete')}
  ${COMPLETION_SIGNAL}
- ${t('prompt.signal_failed')}
  ${FAILURE_SIGNAL}
  ${t('prompt.failure_reason')}
`;

  return prompt;
}

/**
 * 결과 분석 (완료 조건 충족 여부)
 * @param {string} output
 * @param {object} options
 * @param {boolean} [options.strictMode=false] - 엄격 모드 (완료 신호 필수)
 * @returns {{success: boolean, reason: string|null}}
 */
function analyzeResult(output, options = {}) {
  const { strictMode = false } = options;
  // 1. 완료 신호 기반 판단 (최우선)
  const hasCompletionSignal = output.includes(COMPLETION_SIGNAL);
  const hasFailureSignal = output.includes(FAILURE_SIGNAL);

  // 명시적 완료 신호가 있으면 성공
  if (hasCompletionSignal && !hasFailureSignal) {
    return { success: true, reason: null };
  }

  // 명시적 실패 신호가 있으면 실패
  if (hasFailureSignal) {
    const reason = extractFailureReason(output);
    return { success: false, reason };
  }

  // 2. 완료 신호가 없는 경우 패턴 기반 폴백 분석
  const criticalFailPatterns = [
    /error:\s*(.{0,100})/i,
    /fatal:\s*(.{0,100})/i,
    /exception:\s*(.{0,100})/i,
    /panic:\s*(.{0,100})/i,
    /failed to\s+(.{0,50})/i,
    /could not\s+(.{0,50})/i,
    /unable to\s+(.{0,50})/i
  ];

  // 성공 지표 패턴
  const successIndicators = [
    '완료했',
    '완료됐',
    '작업을 완료',
    'successfully',
    'completed successfully',
    'all tests passed',
    '모든 테스트 통과',
    'build succeeded',
    '빌드 성공'
  ];

  // 마지막 출력 부분 분석 (결론 부분이 중요)
  const lastPortion = output.slice(-2000);

  // 성공 지표가 마지막 부분에 있는지 확인
  const hasSuccessIndicator = successIndicators.some(pattern =>
    lastPortion.toLowerCase().includes(pattern.toLowerCase())
  );

  // 심각한 오류가 마지막 부분에 있는지 확인
  for (const pattern of criticalFailPatterns) {
    const match = lastPortion.match(pattern);
    if (match) {
      // 성공 지표가 오류 이후에 나타나면 성공으로 간주
      if (hasSuccessIndicator) {
        const errorIndex = lastPortion.search(pattern);
        const successIndex = successIndicators.reduce((minIdx, p) => {
          const idx = lastPortion.toLowerCase().lastIndexOf(p.toLowerCase());
          return idx > minIdx ? idx : minIdx;
        }, -1);

        if (successIndex > errorIndex) {
          return { success: true, reason: null };
        }
      }
      return { success: false, reason: match[1]?.trim() || t('executor.unknown_error') };
    }
  }

  // 성공 지표가 있으면 성공
  if (hasSuccessIndicator) {
    return { success: true, reason: null };
  }

  // 3. 완료 신호도 없고 명확한 판단이 안되는 경우
  if (strictMode) {
    // 엄격 모드: 완료 신호가 없으면 실패로 처리
    debug('Strict mode: No completion signal - treating as failure');
    return { success: false, reason: t('executor.no_completion_signal') };
  }

  // 일반 모드: 불확실하면 성공으로 간주 (하위 호환성)
  debug('No completion signal - uncertain result, assuming success');
  return { success: true, reason: null };
}

/**
 * exitCode 기반 실패 사유 추출
 * @param {number} exitCode
 * @param {string} output
 * @returns {string}
 */
function extractExitCodeReason(exitCode, output) {
  // exitCode별 기본 사유
  const baseReasons = {
    1: t('executor.exit_reason_general'),      // 일반 오류
    2: t('executor.exit_reason_usage'),        // 잘못된 사용법
    126: t('executor.exit_reason_permission'), // 실행 권한 없음
    127: t('executor.exit_reason_not_found'),  // 명령어 없음
    130: t('executor.exit_reason_interrupt'),  // Ctrl+C (SIGINT)
    137: t('executor.exit_reason_killed'),     // SIGKILL
    143: t('executor.exit_reason_terminated')  // SIGTERM
  };

  const baseReason = baseReasons[exitCode] || t('executor.exit_reason_unknown', { code: exitCode });

  // 출력에서 구체적인 오류 메시지 추출 시도
  const detailedReason = extractFailureReason(output);

  // 알 수 없는 오류가 아니면 상세 사유 포함
  if (detailedReason !== t('executor.unknown_error')) {
    return `${baseReason}: ${detailedReason}`;
  }

  return baseReason;
}

/**
 * 실패 이유 추출
 * @param {string} output
 * @returns {string}
 */
function extractFailureReason(output) {
  // 실패 신호 이후의 "실패 이유:" 패턴 찾기
  const failureMatch = output.match(/<promise>FAILED<\/promise>\s*(?:실패 이유:|Reason:|Failure reason:)?\s*(.{1,200})/i);
  if (failureMatch) {
    return failureMatch[1].trim();
  }

  // 일반적인 오류 메시지 추출
  const errorPatterns = [
    /error:\s*(.{1,150})/i,
    /failed:\s*(.{1,150})/i,
    /실패:\s*(.{1,150})/,
    /오류:\s*(.{1,150})/
  ];

  for (const pattern of errorPatterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return t('executor.unknown_error');
}

/**
 * 작업 요약 생성 (전체 출력 반환)
 * @param {string} output
 * @param {boolean} success
 * @param {string|null} reason
 * @returns {string}
 */
function generateSummary(output, success, reason = null) {
  // 전체 출력 반환 (CLI에서 보이는 것처럼)
  const fullOutput = escapeHtml(output);

  if (success) {
    return fullOutput;
  } else {
    // 실패 이유가 있으면 앞에 포함
    const reasonText = reason ? `${t('executor.failure_reason_prefix', { reason: escapeHtml(reason) })}\n\n` : '';
    return reasonText + fullOutput;
  }
}

/**
 * 단일 작업 처리 (병렬/순차 공통)
 * @param {object} task
 * @param {boolean} isParallel
 */
/* istanbul ignore next */
async function processTask(task, isParallel = false) {
  const shortId = task.id.slice(-8);
  const prefix = isParallel ? `[${shortId}] ` : '';

  try {
    info('Task started', { taskId: task.id, requirement: task.requirement.slice(0, 50) });

    // CLI에 작업 시작 표시
    console.log('\n' + '='.repeat(60));
    console.log(`${prefix}${t('executor.console_task_start', { id: task.id })}`);
    console.log(`${prefix}${t('executor.console_requirement', { text: task.requirement.slice(0, 100) })}`);
    console.log('='.repeat(60) + '\n');

    // 작업 시작
    await startTask(task.id);
    runningTasks.set(task.id, { startedAt: new Date() });

    const taskStartMsg = isParallel
      ? `🚀 <b>${t('executor.task_start_parallel', { count: runningTasks.size })}</b>`
      : `🚀 <b>${t('executor.task_start')}</b>`;
    await sendMessage(`${taskStartMsg}\n\n${task.requirement.slice(0, 100)}...`);

    // 작업 실행
    const prompt = buildPrompt(task);
    clearClaudeOutput(task.id);
    const { exitCode, output } = await runClaude(prompt, task.workingDirectory, task.id, isParallel);

    let success = false;
    let reason = null;

    // exitCode가 0이 아니면 실패
    if (exitCode !== 0) {
      success = false;
      reason = extractExitCodeReason(exitCode, output);
    } else {
      // 출력 분석
      // 반복 작업(maxRetries > 1)은 엄격 모드 적용 (완료 신호 필수)
      const strictMode = task.maxRetries > 1;
      const result = analyzeResult(output, { strictMode });
      success = result.success;
      reason = result.reason;
    }

    if (success) {
      // 성공
      const fullOutput = generateSummary(output, true);
      await completeTask(task.id, fullOutput);
      const totalRetries = task.currentRetry + 1;

      // CLI에 작업 완료 표시
      console.log('\n' + '-'.repeat(60));
      console.log(`${prefix}${t('executor.console_task_complete', { id: task.id, current: totalRetries, max: task.maxRetries })}`);
      console.log('-'.repeat(60) + '\n');

      // 헤더 메시지
      await sendMessage(
        `✅ <b>${t('executor.task_complete')}</b>\n\n` +
        `📝 ${t('executor.requirement_label', { text: task.requirement })}\n\n` +
        `🔄 ${t('executor.retries_count', { current: totalRetries, max: task.maxRetries })}`
      );

      // 전체 CLI 출력 (분할 전송)
      await sendLongMessage(`📋 <b>${t('executor.cli_output_label')}</b>\n<pre>${fullOutput}</pre>`);
      info('Task completed', { taskId: task.id });
    } else {
      // 실패 - 재시도 가능한지 확인
      const { task: updatedTask, canRetry } = await incrementRetry(task.id);

      if (canRetry) {
        // 재시도
        info('Task retry', { taskId: task.id, retry: updatedTask.currentRetry, reason });

        console.log('\n' + '-'.repeat(60));
        console.log(`${prefix}${t('executor.console_task_retry', { id: task.id, current: updatedTask.currentRetry, max: task.maxRetries })}`);
        if (reason) console.log(`${prefix}${t('executor.console_retry_reason', { reason: reason.slice(0, 100) })}`);
        console.log('-'.repeat(60) + '\n');

        const reasonText = reason ? `\n${t('executor.retry_reason', { reason: escapeHtml(reason) })}` : '';
        await sendMessage(`🔄 <b>${t('executor.task_retry', { current: updatedTask.currentRetry, max: task.maxRetries })}</b>${reasonText}`);
      } else {
        // 최종 실패
        const fullOutput = generateSummary(output, false, reason);
        await failTask(task.id, fullOutput);
        const totalRetries = updatedTask.currentRetry;

        console.log('\n' + '-'.repeat(60));
        console.log(`${prefix}${t('executor.console_task_failed', { id: task.id, current: totalRetries, max: task.maxRetries })}`);
        if (reason) console.log(`${prefix}${t('executor.console_retry_reason', { reason: reason.slice(0, 100) })}`);
        console.log('-'.repeat(60) + '\n');

        // 헤더 메시지
        await sendMessage(
          `❌ <b>${t('executor.task_failed')}</b>\n\n` +
          `📝 ${t('executor.requirement_label', { text: task.requirement })}\n\n` +
          `🔄 ${t('executor.retries_after_fail', { current: totalRetries, max: task.maxRetries })}`
        );

        // 전체 CLI 출력 (분할 전송)
        await sendLongMessage(`📋 <b>${t('executor.cli_output_label')}</b>\n<pre>${fullOutput}</pre>`);
        info('Task failed', { taskId: task.id, reason });
      }
    }
  } catch (err) {
    // 안전장치: 예외 발생 시에도 cc-telegram이 종료되지 않도록 함
    error('Task processing error', { taskId: task.id, error: err.message, stack: err.stack });

    try {
      // 작업을 실패 상태로 변경
      const errorSummary = t('executor.task_crash', { error: escapeHtml(err.message || 'Unknown error') });
      await failTask(task.id, errorSummary);

      // 사용자에게 알림
      await sendMessage(
        `❌ <b>${t('executor.task_crashed')}</b>\n\n` +
        `📝 ${t('executor.requirement_label', { text: task.requirement.slice(0, 100) })}\n\n` +
        `⚠️ ${t('executor.crash_reason', { error: escapeHtml(err.message || 'Unknown error') })}`
      );
    } catch (innerErr) {
      // 실패 처리 중 오류도 무시 (cc-telegram 보호)
      error('Failed to handle task error', { taskId: task.id, innerError: innerErr.message });
    }
  } finally {
    runningTasks.delete(task.id);
  }
}

/**
 * 순차 실행 루프
 */
/* istanbul ignore next */
async function sequentialLoop() {
  while (isRunning) {
    try {
      const task = await getNextTask();

      if (!task) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      await processTask(task, false);

      // 다음 작업 전 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      error('Sequential loop error', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 병렬 실행 루프
 * @param {number} maxParallel - 최대 동시 실행 개수
 */
/* istanbul ignore next */
async function parallelLoop(maxParallel) {
  console.log(`\n🔄 ${t('executor.parallel_mode', { count: maxParallel })}\n`);

  while (isRunning) {
    try {
      // 현재 실행 가능한 슬롯 수 계산
      const availableSlots = maxParallel - runningTasks.size;

      if (availableSlots <= 0) {
        // 슬롯이 없으면 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      // 실행 가능한 만큼 작업 가져오기
      const tasks = await getNextTasks(availableSlots);

      if (tasks.length === 0) {
        // 대기 작업 없음
        if (runningTasks.size === 0) {
          // 실행 중인 작업도 없으면 대기
          await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
          // 실행 중인 작업이 있으면 짧게 대기
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        continue;
      }

      // 새 작업들을 병렬로 시작 (await 하지 않음)
      for (const task of tasks) {
        // 이미 실행 중인 작업인지 확인
        if (runningTasks.has(task.id)) continue;

        // 작업 시작 (백그라운드)
        processTask(task, true).catch(err => {
          error('Parallel task error', { taskId: task.id, error: err.message });
        });

        // 작업 시작 간 약간의 딜레이
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 다음 확인 전 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      error('Parallel loop error', err.message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 실행기 시작
 */
export async function startExecutor() {
  if (isRunning) return;

  isRunning = true;
  info('Executor started');

  const config = await loadConfig();

  // 병렬/순차 모드 선택
  /* istanbul ignore next */
  if (config.parallelExecution) {
    parallelLoop(config.maxParallel).catch(err => {
      error('Parallel loop error', err.message);
    });
  } else {
    sequentialLoop().catch(err => {
      error('Sequential loop error', err.message);
    });
  }
}

/**
 * 실행기 중지
 */
export function stopExecutor() {
  isRunning = false;
  info('Executor stopped');
}

/**
 * 현재 실행중인 작업 ID들
 * @returns {string[]}
 */
export function getRunningTaskIds() {
  return Array.from(runningTasks.keys());
}

/**
 * 현재 실행중인 작업 ID (하위 호환성)
 * @returns {string|null}
 */
export function getCurrentTaskId() {
  const ids = getRunningTaskIds();
  return ids.length > 0 ? ids[0] : null;
}

/**
 * 실행중인 작업 취소 (프로세스 종료)
 * @param {string} taskId
 * @returns {boolean} 성공 여부
 */
export function cancelRunningTask(taskId) {
  const proc = runningProcesses.get(taskId);
  if (proc) {
    try {
      // Windows에서는 taskkill 사용, 그 외는 SIGTERM
      if (process.platform === 'win32') {
        // Windows에서 프로세스 트리 전체 종료
        try {
          execSync(`taskkill /pid ${proc.pid} /T /F`, { windowsHide: true });
        } catch {
          // taskkill 실패 시 직접 kill 시도
          proc.kill('SIGTERM');
        }
      } else {
        proc.kill('SIGTERM');
      }
      runningProcesses.delete(taskId);
      runningTasks.delete(taskId);
      info('Task cancelled', { taskId });
      return true;
    } catch (err) {
      error('Failed to cancel task', { taskId, error: err.message });
      return false;
    }
  }
  return false;
}

/**
 * 실행 중인 작업인지 확인
 * @param {string} taskId
 * @returns {boolean}
 */
export function isTaskRunning(taskId) {
  return runningProcesses.has(taskId);
}

// 테스트용 export
export { analyzeResult, extractFailureReason, extractExitCodeReason, escapeHtml, buildPrompt, generateSummary };
