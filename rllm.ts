import { rllmConfig } from './rllm-config.ts'
import { getGithubPr } from './rllm-lib.ts'

const main = async () => {
  console.log('Review LLM start')

  const { llm, src } = rllmConfig
  console.log('Config:', { llm, src: { type: src.type, include: src.include, exclude: src.exclude } })

  switch (src.type) {
    case 'github':
      await getGithubPr(src)
      break
    case 'gitlab':
      break
  }

  // if (targetSrc === 'github') {
  //   const token = getEnv('GITHUB_TOKEN')
  //   const repo = getEnv('GITHUB_ACTION_REPOSITORY')
  //   const prNum = getEnv('GITHUB_PULL_REQUEST_NUM')
  //   await getGithubPr({ token, repo, prNum })
  // }
  // if (targetSrc === 'gitlab') {
  //   const token = getEnv('GITLAB_TOKEN')
  //   const serverUrl = getEnv('CI_SERVER_URL')
  //   const projectId = getEnv('CI_PROJECT_ID')
  //   const mrId = getEnv('CI_MERGE_REQUEST_IID')

  //   const mr = await getGitlabMr({ token, serverUrl, projectId, mrId })
  //   const regex = new RegExp(targetFileRegex)
  //   const targets = mr.changes.filter((value) => regex.test(value.path))
  //   // await review({ endpoint, model, prompt })
  // }

  console.log('Review LLM end')
}

main()
