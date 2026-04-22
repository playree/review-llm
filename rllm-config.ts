import { type RllmConfig, getEnv, getEnvNum } from './rllm-lib.ts'

/**
 * 設定 Github用
 */
export const rllmConfig: RllmConfig = {
  llm: {
    endpoint: 'http://172.16.123.50:11434',
    model: 'qwen2.5-coder:7b',
    prompt: '不具合の発見を優先にレビューして',
  },
  src: {
    type: 'github',
    token: getEnv('GITHUB_TOKEN'),
    repository: getEnv('GITHUB_REPOSITORY'),
    pullRequestNumber: getEnvNum('GITHUB_PULL_REQUEST_NUM'),
    include: [/\.ts$/],
  },
}
