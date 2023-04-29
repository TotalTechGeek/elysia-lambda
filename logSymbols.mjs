import chalk from 'chalk'

/**
 * Copied from: https://github.com/sindresorhus/is-unicode-supported
 * Replicated to avoid bundling issues & allow for stricter control.
 * MIT License
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)  *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:  *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.  *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
export function isUnicodeSupported () {
  if (process.platform !== 'win32') {
    return process.env.TERM !== 'linux' // Linux console (kernel)
  }

  return Boolean(process.env.CI) ||
    Boolean(process.env.WT_SESSION) || // Windows Terminal
    Boolean(process.env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
    process.env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
    process.env.TERM_PROGRAM === 'Terminus-Sublime' ||
    process.env.TERM_PROGRAM === 'vscode' ||
    process.env.TERM === 'xterm-256color' ||
    process.env.TERM === 'alacritty' ||
    process.env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
}

const main = {
  info: chalk.blue('ℹ'),
  success: chalk.green('✔'),
  warning: chalk.yellow('⚠'),
  error: chalk.red('✖')
}

const fallback = {
  info: chalk.blue('i'),
  success: chalk.green('√'),
  warning: chalk.yellow('‼'),
  error: chalk.red('×')
}

const logSymbols = isUnicodeSupported() ? main : fallback
export default logSymbols