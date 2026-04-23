import { rllmConfig } from './rllm-config.ts'
import { getGithubPr, review } from './rllm-lib.ts'

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
      const pr = await getGithubPr(src)
      for (const file of pr.files) {
        await review({ ...llm, src: file })
      }
      break
    }
    case 'gitlab': {
      break
    }
  }

  console.log('\nend.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
