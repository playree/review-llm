const getEnv = (key: string, defaultValue?: string) => {
  const value = process.env[key]
  if (!value) {
    if (defaultValue) {
      return defaultValue
    }
    throw new Error(`Env not found: ${key}`)
  }
  return value
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

type GitLabMrResponse = {
  source_branch: string
  changes?: {
    diff: string
    new_path: string
  }[]
}

const review = async ({ endpoint, model, prompt }: { endpoint: string; model: string; prompt: string }) => {
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
          content: prompt,
        },
      ],
      stream: false,
    }),
  })

  const result = (await response.json()) as ChatResponse
  console.log(result)

  const content = result?.choices[0]?.message.content
  console.log(content)
  return content
}

const getGitlabMr = async ({
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

const main = async () => {
  console.log('start')

  const endpoint = getEnv('LLM_ENDPOINT')
  console.log('endpoint', endpoint)
  const model = getEnv('LLM_MODEL')
  console.log('model', model)
  const prompt = getEnv('LLM_PROMPT')
  console.log('prompt', prompt)

  const serverUrl = getEnv('CI_SERVER_URL')
  console.log('serverUrl', serverUrl)
  const projectId = getEnv('CI_PROJECT_ID')
  console.log('projectId', projectId)
  const mrId = getEnv('CI_MERGE_REQUEST_IID')
  console.log('mrId', mrId)
  const token = getEnv('GITLAB_ACCESS_TOKEN')
  console.log('token', token)
  const pattern = getEnv('TARGET_FILE_REGEX')
  console.log('pattern', pattern)

  const mr = await getGitlabMr({ token, serverUrl, projectId, mrId })
  const regex = new RegExp(pattern)
  const targets = mr.changes.filter((value) => regex.test(value.path))
  // await review({ endpoint, model, prompt })

  console.log('end')
}

main()
