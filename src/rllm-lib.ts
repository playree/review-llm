import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

type GithubSrc = Readonly<{
  src: Readonly<{
    type: 'github'
    token: string
    repository: string
    pullRequestNumber: number
    include?: string[] | undefined
    exclude?: string[] | undefined
    useLocalSrc?: boolean
  }>
}>
type GitlabSrc = Readonly<{
  src: Readonly<{
    type: 'gitlab'
    server: string
    token: string
    projectId: number
    mergeRequestIid: number
    include?: string[] | undefined
    exclude?: string[] | undefined
    useLocalSrc?: boolean
  }>
}>
type LlmOllama = {
  type: 'ollama'
  endpoint: string
  apiKey?: string
  model: string
  prompt: string
  limit_files?: number
  think?: boolean
  num_ctx?: number
}
type LlmOpenAI = {
  type: 'openai'
  endpoint: string
  apiKey?: string
  model: string
  prompt: string
  limit_files?: number
}
export type RllmConfig = Readonly<{
  llm: Readonly<LlmOllama> | Readonly<LlmOpenAI>
}> &
  (GithubSrc | GitlabSrc)

export const getEnv = (key: string) => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Env not found: ${key}`)
  }
  return value
}
export const getEnvNum = (key: string) => Number(getEnv(key))
export const isDebug = () => process.env.NODE_ENV === 'development'
export const debug = (params: object) => {
  if (isDebug()) {
    console.debug('```')
    console.debug(JSON.stringify(params, null, 2))
    console.debug('```\n')
  }
}

type FileSrc = { filename: string; patch?: string; raw?: string; raw_url?: string }
type TargetSrc = { ref: string; files: (() => Promise<FileSrc>)[] }

type GenerateResponse = {
  response: string
  done: boolean
  thinking: string
  total_duration: number
  load_duration: number
  prompt_eval_count: number
  eval_count: number
  eval_duration: number
}

export const reviewOllama = async ({
  endpoint,
  apiKey,
  model,
  prompt,
  think,
  num_ctx,
  fileSrc,
}: LlmOllama & {
  fileSrc: () => Promise<FileSrc>
}) => {
  const { filename, raw, raw_url } = await fileSrc()
  console.log(`\n## ${filename}\n`)

  if (!raw) {
    console.log('Skip')
    return null
  }

  debug({ raw_url })

  const start = performance.now()
  const response = await fetch(new URL('/api/generate', endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      model,
      prompt: `${prompt}\n\n${filename}\n\n${raw}`,
      stream: false,
      think,
      options: num_ctx ? { num_ctx } : undefined,
    }),
  })
  const end = performance.now()
  const duration = end - start

  if (!response.ok) {
    console.warn('Fetch Failed')
    return null
  }

  const result = (await response.json()) as GenerateResponse
  if (!result.response) {
    console.warn('LLM returned empty or invalid response')
    return null
  }
  const content = result.response
  console.log(content)
  console.log(`\nTime ${duration.toFixed(2)} ms\n`)

  const { thinking, total_duration, load_duration, prompt_eval_count, eval_count, eval_duration } = result
  debug({ think: !!thinking, total_duration, load_duration, prompt_eval_count, eval_count, eval_duration })

  return { filename, content }
}

type ChatResponse = {
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
}

export const reviewOpenai = async ({
  endpoint,
  apiKey,
  model,
  prompt,
  fileSrc,
}: LlmOpenAI & {
  fileSrc: () => Promise<FileSrc>
}) => {
  const { filename, raw, raw_url } = await fileSrc()
  console.log(`\n## ${filename}\n`)

  if (!raw) {
    console.log('Skip')
    return null
  }

  debug({ raw_url })

  const start = performance.now()
  const response = await fetch(new URL('/v1/chat/completions', endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${filename}\n\n${raw}`,
        },
      ],
      stream: false,
    }),
  })
  const end = performance.now()
  const duration = end - start

  if (!response.ok) {
    console.warn('Fetch Failed')
    return null
  }

  const result = (await response.json()) as ChatResponse
  if (!result.choices?.[0]?.message?.content) {
    console.warn('LLM returned empty or invalid response')
    return null
  }
  const content = result.choices[0].message.content
  console.log(content)
  console.log(`\nTime ${duration.toFixed(2)} ms\n`)

  const usage = result?.usage
  debug(usage)

  return { filename, content }
}

export const review = async (
  params: RllmConfig['llm'] & {
    fileSrc: () => Promise<FileSrc>
  },
) => {
  if (params.type === 'ollama') {
    return reviewOllama(params)
  }
  return reviewOpenai(params)
}

export const reviews = async (
  params: RllmConfig['llm'] & {
    files: (() => Promise<FileSrc>)[]
  },
) => {
  const { files, ...llm } = params
  if (llm.limit_files && llm.limit_files < files.length) {
    console.warn('Limit over:', files.length)
    return
  }
  for (const file of files) {
    await review({ ...llm, fileSrc: file })
  }
}

const isTarget = ({
  filename,
  include,
  exclude,
}: {
  filename: string
  include?: string[] | undefined
  exclude?: string[] | undefined
}) => {
  if (include?.length) {
    if (!include.some((re) => new RegExp(re).test(filename))) {
      return false
    }
  }
  if (exclude?.length) {
    if (exclude.some((re) => new RegExp(re).test(filename))) {
      return false
    }
  }
  return true
}

type GithubPrResponse = {
  head: {
    ref: string
  }
  changed_files: number
}

type GithubPrFilesResponse = {
  filename: string
  status: 'added' | 'modified' | 'removed'
  raw_url: string
  patch: string
}[]

export const getGithubPr = async ({
  token,
  repository,
  pullRequestNumber,
  include,
  exclude,
  useLocalSrc,
}: GithubSrc['src']): Promise<TargetSrc> => {
  const prResponse = await fetch(new URL(`/repos/${repository}/pulls/${pullRequestNumber}`, 'https://api.github.com'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  const prResult = (await prResponse.json()) as GithubPrResponse

  const perPage = 100
  let allFiles: GithubPrFilesResponse = []
  let page = 1
  while (true) {
    const response = await fetch(
      new URL(
        `/repos/${repository}/pulls/${pullRequestNumber}/files?per_page=${perPage}&page=${page}`,
        'https://api.github.com',
      ),
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      },
    )
    const result = (await response.json()) as GithubPrFilesResponse
    allFiles = allFiles.concat(result)

    const linkHeader = response.headers.get('link')
    if (linkHeader && linkHeader.includes('rel="next"')) {
      page++
    } else {
      break
    }
  }

  const ret = {
    ref: prResult.head.ref,
    files: allFiles
      // include/excludeで対象ファイルを選定
      .filter(({ filename, status }) => status !== 'removed' && isTarget({ filename, include, exclude }))
      // 対象ファイルの内容を取得
      .map(({ filename, raw_url, patch }) => async () => {
        if (!patch) {
          // バイナリ(もしくは巨大ファイル)
          return { filename }
        }

        try {
          if (useLocalSrc) {
            // ローカルから取得
            const raw = await readFile(filename, 'utf8')
            return { filename, patch, raw, raw_url: filename }
          } else {
            // raw_urlから取得
            const response = await fetch(raw_url, {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`,
              },
            })
            const raw = await response.text()
            return { filename, patch, raw, raw_url }
          }
        } catch (err) {
          console.warn(`Error fetching ${filename}:`, err)
          return { filename }
        }
      }),
  }
  console.log(
    '# Github PR\n',
    `
- repository : ${repository}
- pullRequestNumber : ${pullRequestNumber}
- ref : ${ret.ref}
- files.length : ${ret.files.length}
`,
  )
  return ret
}

type GitLabMrResponse = {
  source_branch: string
  references: {
    full: string
  }
}

type GitLabMrFilesResponse = {
  new_path: string
  deleted_file: boolean
  diff: string
}[]

export const getGitLabMr = async ({
  token,
  server,
  projectId,
  mergeRequestIid,
  include,
  exclude,
  useLocalSrc,
}: GitlabSrc['src']): Promise<TargetSrc> => {
  const mrResponse = await fetch(new URL(`/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}`, server), {
    method: 'GET',
    headers: {
      'PRIVATE-TOKEN': token,
    },
  })
  const mrResult = (await mrResponse.json()) as GitLabMrResponse

  const perPage = 100
  let allFiles: GitLabMrFilesResponse = []
  let page: string | null = '1'
  while (page) {
    const response = await fetch(
      new URL(
        `/api/v4/projects/${projectId}/merge_requests/${mergeRequestIid}/diffs?per_page=${perPage}&page=${page}`,
        server,
      ),
      {
        method: 'GET',
        headers: {
          'PRIVATE-TOKEN': token,
        },
      },
    )
    const result = (await response.json()) as GitLabMrFilesResponse
    allFiles = allFiles.concat(result)

    page = response.headers.get('x-next-page')
  }

  const ref = mrResult.source_branch
  const ret = {
    ref,
    files: allFiles
      // include/excludeで対象ファイルを選定
      .filter(({ new_path, deleted_file }) => !deleted_file && isTarget({ filename: new_path, include, exclude }))
      // 対象ファイルの内容を取得
      .map(({ new_path: filename, diff: patch }) => async () => {
        if (!patch) {
          // バイナリ(もしくは巨大ファイル)
          return { filename }
        }

        try {
          if (useLocalSrc) {
            // ローカルから取得
            const raw = await readFile(filename, 'utf8')
            return { filename, patch, raw, raw_url: filename }
          } else {
            // raw_urlから取得
            const raw_url = `/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filename)}?ref=${ref}`
            const response = await fetch(new URL(raw_url, server), {
              method: 'GET',
              headers: {
                'PRIVATE-TOKEN': token,
              },
            })
            const raw = await response.text()
            return { filename, patch, raw, raw_url }
          }
        } catch (err) {
          console.warn(`Error fetching ${filename}:`, err)
          return { filename }
        }
      }),
  }
  console.log(
    '# GitLab MR\n',
    `
- repository : ${mrResult.references?.full}
- mergeRequestIid : ${mergeRequestIid}
- ref : ${ret.ref}
- files.length : ${ret.files.length}
`,
  )
  return ret
}
