/**
 * 클로드 코드 실행기
 * Ralph Wiggum 방식 반복 실행
 */

import { spawn } from 'child_process';
import {
  getNextTask,
  startTask,
  incrementRetry,
  completeTask,
  failTask
} from './tasks.js';
import { loadConfig } from './config.js';
import { sendMessage, updateClaudeOutput, clearClaudeOutput } from './telegram.js';
import { info, error, debug } from './utils/logger.js';

let isRunning = false;
let currentTaskId = null;
let cachedClaudeCommand = null;

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
  if (cachedClaudeCommand) return cachedClaudeCommand;

  const config = await loadConfig();

  if (config.claudeCommand) {
    // 사용자 지정 명령어 사용
    const parts = config.claudeCommand.split(' ');
    const command = parts[0];
    const args = [...parts.slice(1), '--dangerously-skip-permissions'];
    cachedClaudeCommand = { command, args, useShell: true };
  } else {
    // 자동 감지
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      cachedClaudeCommand = {
        command: 'claude.cmd',
        args: ['--dangerously-skip-permissions'],
        useShell: true
      };
    } else {
      cachedClaudeCommand = {
        command: 'claude',
        args: ['--dangerously-skip-permissions'],
        useShell: false
      };
    }
  }

  return cachedClaudeCommand;
}

/**
 * 클로드 코드 실행
 * @param {string} prompt
 * @param {string} cwd
 * @returns {Promise<{exitCode: number, output: string}>}
 */
/* istanbul ignore next */
async function runClaude(prompt, cwd) {
  const { command, args, useShell } = await getClaudeCommand();

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

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // CLI에 실시간 출력 표시
      process.stdout.write(text);
      // 텔레그램에도 실시간 출력 업데이트
      text.split('\n').forEach(line => {
        if (line.trim()) {
          updateClaudeOutput(line.trim());
        }
      });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      output += text;
      // CLI에 stderr도 실시간 출력 표시
      process.stderr.write(text);
    });

    // 프롬프트 전송
    proc.stdin.write(prompt);
    proc.stdin.end();

    // 타임아웃 (30분)
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('실행 시간 초과 (30분)'));
    }, 30 * 60 * 1000);

    proc.on('close', (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode: exitCode || 0, output });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
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
  return `# 작업 요청

## 요구사항
${task.requirement}

## 완료 조건
${task.completionCriteria || '없음'}

## 지시사항
- 위 요구사항을 수행하고 완료 조건을 충족시켜주세요.
- 작업이 완료되면 완료 조건이 충족되었는지 확인해주세요.
- 완료 조건을 충족하지 못했다면 그 이유를 설명해주세요.

## 완료 신호 (중요!)
- 모든 작업을 완료하고 완료 조건을 충족했다면 반드시 다음 신호를 출력해주세요:
  ${COMPLETION_SIGNAL}
- 작업을 완료할 수 없거나 완료 조건을 충족하지 못했다면 다음 신호와 함께 이유를 출력해주세요:
  ${FAILURE_SIGNAL}
  실패 이유: [구체적인 이유]
`;
}

/**
 * 결과 분석 (완료 조건 충족 여부)
 * @param {string} output
 * @returns {{success: boolean, reason: string|null}}
 */
function analyzeResult(output) {
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
  const lowerOutput = output.toLowerCase();

  // 심각한 오류 패턴 (이런 패턴이 있으면 실패)
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
      return { success: false, reason: match[1]?.trim() || '오류 발생' };
    }
  }

  // 성공 지표가 있으면 성공
  if (hasSuccessIndicator) {
    return { success: true, reason: null };
  }

  // 3. 완료 신호도 없고 명확한 판단이 안되면 불확실 (성공으로 간주하되 경고)
  debug('완료 신호 없음 - 불확실한 결과, 성공으로 간주');
  return { success: true, reason: null };
}

/**
 * 실패 이유 추출
 * @param {string} output
 * @returns {string}
 */
function extractFailureReason(output) {
  // 실패 신호 이후의 "실패 이유:" 패턴 찾기
  const failureMatch = output.match(/<promise>FAILED<\/promise>\s*(?:실패 이유:|Reason:)?\s*(.{1,200})/i);
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

  return '알 수 없는 오류';
}

/**
 * 작업 실행
 * @param {object} task
 * @returns {Promise<{success: boolean, output: string, reason: string|null}>}
 */
/* istanbul ignore next */
async function executeTask(task) {
  const prompt = buildPrompt(task);

  try {
    clearClaudeOutput();
    const { exitCode, output } = await runClaude(prompt, task.workingDirectory);

    // exitCode가 0이 아니면 실패
    if (exitCode !== 0) {
      return { success: false, output, reason: `프로세스 종료 코드: ${exitCode}` };
    }

    // 출력 분석
    const result = analyzeResult(output);

    return { success: result.success, output, reason: result.reason };
  } catch (err) {
    return { success: false, output: err.message, reason: err.message };
  }
}

/**
 * 작업 요약 생성
 * @param {string} output
 * @param {boolean} success
 * @param {string|null} reason
 * @returns {string}
 */
function generateSummary(output, success, reason = null) {
  // 마지막 몇 줄 추출
  const lines = output.split('\n').filter(l => l.trim());
  const lastLines = escapeHtml(lines.slice(-5).join('\n'));

  if (success) {
    return `작업 완료. ${lastLines.slice(0, 250)}`;
  } else {
    // 실패 이유가 있으면 포함
    const reasonText = reason ? `\n실패 원인: ${escapeHtml(reason)}` : '';
    return `작업 실패.${reasonText}\n${lastLines.slice(0, 200)}`;
  }
}

/**
 * 실행 루프
 */
/* istanbul ignore next */
async function executionLoop() {
  while (isRunning) {
    try {
      // 다음 작업 가져오기
      const task = await getNextTask();

      if (!task) {
        // 대기 작업 없음, 5초 후 다시 확인
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      currentTaskId = task.id;
      info('작업 시작', { taskId: task.id, requirement: task.requirement.slice(0, 50) });

      // CLI에 작업 시작 표시
      console.log('\n' + '='.repeat(60));
      console.log(`[작업 시작] ${task.id}`);
      console.log(`요구사항: ${task.requirement.slice(0, 100)}`);
      console.log('='.repeat(60) + '\n');

      // 작업 시작
      await startTask(task.id);
      await sendMessage(`🚀 <b>작업 시작</b>\n\n${task.requirement.slice(0, 100)}...`);

      // 작업 실행
      const { success, output, reason } = await executeTask(task);

      if (success) {
        // 성공
        const summary = generateSummary(output, true);
        await completeTask(task.id, summary);
        const totalRetries = task.currentRetry + 1; // 현재 시도가 성공한 것이므로 +1

        // CLI에 작업 완료 표시
        console.log('\n' + '-'.repeat(60));
        console.log(`[작업 완료] ${task.id} (${totalRetries}/${task.maxRetries}회)`);
        console.log('-'.repeat(60) + '\n');

        await sendMessage(
          `✅ <b>작업 완료!</b>\n\n` +
          `📝 요구사항: ${task.requirement}\n\n` +
          `🔄 반복횟수: ${totalRetries}/${task.maxRetries}회\n\n` +
          `📋 요약:\n${summary}`
        );
        info('작업 완료', { taskId: task.id });
      } else {
        // 실패 - 재시도 가능한지 확인
        const { task: updatedTask, canRetry } = await incrementRetry(task.id);

        if (canRetry) {
          // 재시도 - incrementRetry에서 이미 상태를 ready로 변경하고 저장함
          info('작업 재시도', { taskId: task.id, retry: updatedTask.currentRetry, reason });

          // CLI에 재시도 표시
          console.log('\n' + '-'.repeat(60));
          console.log(`[재시도] ${task.id} (${updatedTask.currentRetry}/${task.maxRetries})`);
          if (reason) console.log(`원인: ${reason.slice(0, 100)}`);
          console.log('-'.repeat(60) + '\n');

          const reasonText = reason ? `\n원인: ${escapeHtml(reason)}` : '';
          await sendMessage(`🔄 <b>재시도 중...</b> (${updatedTask.currentRetry}/${task.maxRetries})${reasonText}`);
        } else {
          // 최종 실패
          const summary = generateSummary(output, false, reason);
          await failTask(task.id, summary);
          const totalRetries = updatedTask.currentRetry; // 총 시도 횟수

          // CLI에 작업 실패 표시
          console.log('\n' + '-'.repeat(60));
          console.log(`[작업 실패] ${task.id} (${totalRetries}/${task.maxRetries}회 시도)`);
          if (reason) console.log(`원인: ${reason.slice(0, 100)}`);
          console.log('-'.repeat(60) + '\n');

          await sendMessage(
            `❌ <b>작업 실패</b>\n\n` +
            `📝 요구사항: ${task.requirement}\n\n` +
            `🔄 반복횟수: ${totalRetries}/${task.maxRetries}회 시도 후 실패\n\n` +
            `📋 요약:\n${summary}`
          );
          info('작업 실패', { taskId: task.id, reason });
        }
      }

      currentTaskId = null;

      // 다음 작업 전 짧은 대기
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (err) {
      error('실행 루프 오류', err.message);
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
  info('실행기 시작');

  // 백그라운드 실행 루프 시작
  /* istanbul ignore next */
  executionLoop().catch(err => {
    error('실행 루프 오류', err.message);
  });
}

/**
 * 실행기 중지
 */
export function stopExecutor() {
  isRunning = false;
  info('실행기 중지');
}

/**
 * 현재 실행중인 작업 ID
 * @returns {string|null}
 */
export function getCurrentTaskId() {
  return currentTaskId;
}

// 테스트용 export
export { analyzeResult, extractFailureReason, escapeHtml, buildPrompt, generateSummary };
