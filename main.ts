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

const main = async () => {
  console.log('start')

  const endpoint = getEnv('LLM_ENDPOINT')
  console.log('endpoint', endpoint)
  const model = getEnv('LLM_MODEL')
  console.log('model', model)
  const prompt = getEnv('LLM_PROMPT')
  console.log('prompt', prompt)

  await review({ endpoint, model, prompt })

  console.log('end')
}

main()
