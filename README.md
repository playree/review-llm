- [Review LLM](#review-llm)
- [スクリプト概要](#スクリプト概要)
- [クイックガイド](#クイックガイド)
- [使用方法](#使用方法)
  - [スクリプトファイルの配置](#スクリプトファイルの配置)
  - [設定](#設定)
    - [LLM設定](#llm設定)
    - [ソース設定](#ソース設定)
    - [Github](#github)
    - [GitLab](#gitlab)
    - [デバッグ設定](#デバッグ設定)
- [履歴](#履歴)

# Review LLM

OllamaのAPIやOpenAI互換のAPIを利用して、
Githubのプルリクエスト(PR)やGitLabのマージリクエスト(MR)をレビューするためのスクリプトです。

セルフマネージドGitLab環境のCIに組み込みたくて、開発したものです。

# スクリプト概要

1. Github/GitLabのPR/MRを取得する。
2. PR/MRの対象ファイルを取得する。
3. 対象ファイルの内容をOllama/OpenAI互換のAPIにレビュー依頼。
4. レビュー結果を出力。

- 言語はTypeScript\
  PythonやRustなども考えたのですが、今後Next.jsで開発中のWebUIにも組み込みたかったのでTypeScriptを採用。
- Node.jsの標準ライブラリのみで動作\
  パッケージのインストール(`npm install`など)不要。
- TypeScriptのまま直(コンパイルなしで)実行できる形\
  ファイル配置するだけで実行可能としたく、複雑な処理でもないのでいいかなと。

# クイックガイド

`rllm.ts`、`rllm-lib.ts`、`rllm-config.ts`の3ファイルと、必要に応じて`.env`を配置し、下記コマンドを実行するだけです。

- `rllm.ts`
- `rllm-lib.ts`
- `rllm-config.ts`
- `.env` (必要に応じて)

```sh
node --env-file=.env rllm.ts
```

基本的に順番にAPIを叩くだけのスクリプトなので、Node.jsで直接実行(コンパイル不要で実行)できるような作りにしています。\
_※Node.jsでTypeScriptを直接実行する都合上、Node.jsは`v24`以降をご利用ください。_

レビュー内容はMarkdown形式で標準出力されますので、ファイルに保存したい場合は下記のようにリダイレクトしてください。

```sh
node --env-file=.env rllm.ts > review.md
```

# 使用方法

## スクリプトファイルの配置

`rllm.ts`、`rllm-lib.ts`、`rllm-config.ts`の3ファイルを配置します。

## 設定

`rllm-config.ts`を環境に合わせて設定します。\
環境変数から読み込みたい場合は`getEnv('GITHUB_TOKEN')`や`getEnvNum('GITHUB_PULL_REQUEST_NUM')`のように記述してください。

例.

```ts
export const rllmConfig: RllmConfig = {
  llm: {
    type: 'ollama',
    endpoint: 'http://localhost:11434',
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
  },
}
```

### LLM設定

- llm.type : `ollama` | `openai` (必須)\
  利用するAPIに合わせて設定してください。
- llm.endpoint : APIのエンドポイント (必須)\
  `http://localhost:11434`
- llm.model : LLMモデル名 (必須)\
  `qwen3.6:35b`などのモデル名
- llm.prompt : LLMへの指示 (必須)\
  レビューしてという内容
- llm.limitFiles : レビュー可能なファイル数上限\
  上限を設定すると、オーバーしている場合はレビューを行いません。
- llm.think : 思考の有無\
  ※`type=ollama`でのみ指定できます。
- llm.ctxSize : LLMのコンテキストサイズ\
  ※`type=ollama`でのみ指定できます。

### ソース設定

### Github

- src.type : `github` (必須)
- src.token : GitHubのアクセストークン (必須)
- src.repository : リポジトリ名 (必須)
- src.pullRequestNumber : プルリクエストNo (必須)
- src.include : レビュー対象のファイルの正規表現
- src.exclude : レビュー対象外とするファイルの正規表現
- src.useLocalSrc : ローカルのソースを使用するか

### GitLab

- src.type : `gitlab` (必須)
- src.token : GitLabのアクセストークン (必須)
- src.server : GitLabサーバーURL (必須)
- src.projectId : プロジェクトID (必須)
- src.mergeRequestIid : マージリクエストID (必須)
- src.include : レビュー対象のファイルの正規表現
- src.exclude : レビュー対象外とするファイルの正規表現
- src.useLocalSrc : ローカルのソースを使用するか

### デバッグ設定

環境変数に下記を設定すると、デバッグ出力になります。

```
NODE_ENV=development
```

下記などが出力されるようになります。

```
{
  "think": true,
  "total_duration": 60871241461,
  "load_duration": 4762001253,
  "prompt_eval_count": 147,
  "eval_count": 4401,
  "eval_duration": 54401271729
}
```

# 履歴

| ver   | 日付       | 内容 |
| ----- | ---------- | ---- |
| 0.1.0 | 2026/04/26 | 初版 |
