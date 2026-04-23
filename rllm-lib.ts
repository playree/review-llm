type GithubSrc = Readonly<{
  src: Readonly<{
    type: 'github'
    token: string
    repository: string
    pullRequestNumber: number
    include?: RegExp[] | undefined
    exclude?: RegExp[] | undefined
  }>
}>
type GitlabSrc = Readonly<{
  src: Readonly<{
    type: 'gitlab'
    server: string
    include?: RegExp[] | undefined
    exclude?: RegExp[] | undefined
  }>
}>
export type RllmConfig = Readonly<{
  llm: Readonly<{ endpoint: string; model: string; prompt: string }>
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

type FileSrc = { filename: string; patch: string; raw: string }
type TargetSrc = { ref: string; files: FileSrc[] }

export const review = async ({
  endpoint,
  model,
  prompt,
  src,
}: {
  endpoint: string
  model: string
  prompt: string
  src: FileSrc
}) => {
  const response = await fetch(new URL('/v1/chat/completions', endpoint), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\n${src.filename}\n\n${src.raw}`,
        },
      ],
      stream: false,
    }),
  })

  const result = (await response.json()) as ChatResponse
  const content = result?.choices[0]?.message.content
  console.log(`\n## ${src.filename}\n`, content)
  return content
}

const isTarget = ({
  filename,
  include,
  exclude,
}: {
  filename: string
  include?: RegExp[] | undefined
  exclude?: RegExp[] | undefined
}) => {
  if (include) {
    for (const regex of include) {
      if (!regex.test(filename)) {
        return false
      }
    }
  }
  if (exclude) {
    for (const regex of exclude) {
      if (regex.test(filename)) {
        return false
      }
    }
  }
  return true
}

type GithubPrResponse = {
  head: {
    ref: string
  }
}

type GithubPrFilesResponse = {
  filename: string
  raw_url: string
  patch: string
}[]

export const getGithubPr = async ({
  token,
  repository,
  pullRequestNumber,
  include,
  exclude,
}: GithubSrc['src']): Promise<TargetSrc> => {
  const prResponse = await fetch(new URL(`/repos/${repository}/pulls/${pullRequestNumber}`, 'https://api.github.com'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  })
  const prResult = (await prResponse.json()) as GithubPrResponse

  const prFilesResponse = await fetch(
    new URL(`/repos/${repository}/pulls/${pullRequestNumber}/files?per_page=100&page=1`, 'https://api.github.com'),
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    },
  )
  const prFilesResult = (await prFilesResponse.json()) as GithubPrFilesResponse

  const ret = {
    ref: prResult.head.ref,
    files: await Promise.all(
      prFilesResult
        // include/excludeで対象ファイルを選定
        .filter(({ filename, patch }) => !!patch && isTarget({ filename, include, exclude }))
        // 対象ファイルの内容を取得
        .map(async ({ filename, raw_url, patch }) => {
          if (!patch) {
            // バイナリ(もしくは巨大ファイル)
            return { filename, patch, raw: '' }
          }
          const prFilesResponse = await fetch(raw_url, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })
          return { filename, patch, raw: await prFilesResponse.text() }
        }),
    ),
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
  changes?: {
    diff: string
    new_path: string
  }[]
}

export const getGitlabMr = async ({
  token,
  serverUrl,
  projectId,
  mrId,
}: {
  token: string
  serverUrl: string
  projectId: string
  mrId: string
}) => {
  const response = await fetch(new URL(`/api/v4/projects/${projectId}/merge_requests/${mrId}/changes`, serverUrl), {
    method: 'GET',
    headers: {
      'PRIVATE-TOKEN': token,
    },
  })

  const result = (await response.json()) as GitLabMrResponse
  console.log(result)

  if (!result.changes || result.changes.length === 0) {
    return { changes: [] }
  }

  const changes = result.changes.map(({ new_path, diff }) => {
    return { path: new_path, diff }
  })

  return { changes }
}
