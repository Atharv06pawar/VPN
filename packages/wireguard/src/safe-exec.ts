import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface SafeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SafeExecOptions {
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

/**
 * Safely executes a binary with an explicit array of arguments.
 * CRITICAL SECURITY INVARIANT:
 * - Uses execFile with shell: false.
 * - Shell interpolation, pipes, redirects, backticks, and subshells are physically impossible.
 * - Arguments are passed directly to OS execve.
 */
export async function safeExec(
  executable: string,
  args: string[],
  options: SafeExecOptions = {}
): Promise<SafeExecResult> {
  const timeout = options.timeoutMs ?? 10000;

  // Validate executable path / name: prevent shell metacharacters and control chars
  // Supports Windows (C:\Program Files\...) and Linux (/usr/bin/wg, etc.)
  if (/[\x00\r\n;&|`$><"'\t]/.test(executable) || !/^[a-zA-Z0-9_\-./\\: ]+$/.test(executable)) {
    throw new Error(`Invalid executable path: ${executable}`);
  }

  // Validate each argument to ensure no null bytes or control characters
  for (const arg of args) {
    if (/[\x00\r\n]/.test(arg)) {
      throw new Error(`Command argument contains prohibited control characters: ${JSON.stringify(arg)}`);
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync(executable, args, {
      shell: false,
      timeout,
      env: options.env ?? process.env,
      maxBuffer: 1024 * 1024 * 5, // 5MB limit
    });

    return {
      stdout: stdout.toString(),
      stderr: stderr.toString(),
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      stdout: error.stdout ? error.stdout.toString() : '',
      stderr: error.stderr ? error.stderr.toString() : error.message || 'Execution failed',
      exitCode: typeof error.code === 'number' ? error.code : 1,
    };
  }
}
