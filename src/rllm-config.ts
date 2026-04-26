import { type RllmConfig, getEnv, getEnvNum } from './rllm-lib.ts'

/**
 * 設定 Github用
 */
export const rllmConfig: RllmConfig = {
  llm: {
    type: 'ollama',
    endpoint: 'http://172.16.123.50:11434',
    model: 'qwen3.6:35b',
    prompt: '不具合の発見を優先にレビューして',
    limitFiles: 50,
    ctxSize: 65536,
  },
  src: {
    type: 'github',
    token: getEnv('GITHUB_TOKEN'),
    repository: getEnv('GITHUB_REPOSITORY'),
    pullRequestNumber: getEnvNum('GITHUB_PULL_REQUEST_NUM'),
    include: ['\.ts$'],
    exclude: ['rllm(-lib|-config)?\.ts$'],
    useLocalSrc: true,
  },
}

/**
 * 設定 GitLab用
 */
/*
export const rllmConfig: RllmConfig = {
  llm: {
    type: 'ollama',
    endpoint: 'http://172.16.123.50:11434',
    model: 'qwen3.6:35b',
    prompt: '不具合の発見を優先にレビューして',
    limit_files: 50,
    num_ctx: 65536,
  },
  src: {
    type: 'gitlab',
    token: getEnv('GITLAB_TOKEN'),
    server: getEnv('CI_SERVER_URL'),
    projectId: getEnvNum('CI_PROJECT_ID'),
    mergeRequestIid: getEnvNum('CI_MERGE_REQUEST_IID'),
    include: ['\.ts$'],
    exclude: ['rllm(-lib|-config)?\.ts$'],
    useLocalSrc: true,
  },
}
*/
