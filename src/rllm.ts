import { rllmConfig } from './rllm-config.ts'
import { getGithubPr, getGitLabMr, reviews } from './rllm-lib.ts'

const main = async () => {
  const { llm, src } = rllmConfig
  console.log(
    '# Review LLM v0.1.0\n',
    `
- llm.model : ${llm.model}
- llm.prompt : ${llm.prompt}
- src.type : ${src.type}
- src.include : ${src.include ? `\`${src.include.join('`, `')}\`` : ''}
- src.exclude : ${src.exclude ? `\`${src.exclude.join('`, `')}\`` : ''}
`,
  )

  switch (src.type) {
    case 'github': {
      const { files } = await getGithubPr(src)
      await reviews({ ...llm, files })
      break
    }
    case 'gitlab': {
      const { files } = await getGitLabMr(src)
      await reviews({ ...llm, files })
      break
    }
  }

  console.log('\nend.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
