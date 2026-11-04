# dsh-session-console · 会话总控

DeepSeek Harness 的「左侧对话管理员」。侧栏多一个图标，点开是一张覆盖**全部会话**的仪表盘：
状态、消耗、热度、健康度一屏看完；再用一句自然语言指到某个对话，把话派进去，把返回读回来。

![panel](icon.svg)

## 三个能力

**1. 仪表盘（读全局）**

| 指标 | 含义 |
| --- | --- |
| 会话总数 / 运行中 / 冷会话 / 空白 | 全局状态分布 |
| 累计 token（输入 / 输出 / 缓存读 / 缓存写） | 来自 `tokenUsage` projection，不扫归档 |
| 缓存命中率 | `cacheRead ÷ (input + cacheRead + cacheWrite)` |
| 今日活跃 / 本周活跃 | 按会话最后活跃时间分桶 |
| 上下文压力 | 来自 `contextPressure` projection，显示 `pressureTokens ÷ contextWindow` 的百分比 |
| 模型 | 来自 `modelSelection` projection 的 `next`（已合并 `pending`），显示 `provider/model` |
| 热度 | 单一分值：`100/(1+静默小时/6) + log10(1+token)*8 + log10(1+事件)*5 + 运行中40` |
| 最热 / 按工作区聚合 | 谁在烧 token、哪个目录最忙 |

列表支持 全部 / 运行中 / 今日 / 冷会话 / 空会话 过滤，热度 / 消耗 / 最近 排序，以及标题与路径的即时过滤。

**2. 指代（读一句人话）**

在「指代与派任务」里输入 `示例项目的相关内容怎么样了`：

1. 剥掉「怎么样了 / 情况 / 进度 / 相关 / 内容 / 帮我 / 看看」这类口头语，留下主语 `示例项目`；
2. 拿主语去比对每个会话的标题、`cwd`、目录末段、agent preset、会话 id（权重 6 / 4 / 3 / 1 / 1）；
3. 子串命中给满权重加成，其余用 CJK bigram + 拉丁词的 Dice 相似度；
4. `score ≥ 40` 且不存在跨工作区的同分对手才算"锁定"，否则把候选列出来让你点。

比对用的是会话 header 里的**真实 `cwd`**（不是归档目录那串 `~6570~636E~…` 编码名），所以工作区目录叫 `示例项目-v2` 时，一句「示例项目的相关内容」就能直接对上。

同一个工作区里往往有好几个同主题的历史会话（命中分数相同）。这类"兄弟会话"不算歧义，直接取其中热度最高的一个；只有**跨工作区**出现同分对手时才判定为歧义，把候选列出来让你点。

**3. 派任务 / 看返回（写进别的对话）**

选定目标后写一句话，两种投递方式：

- **排队**（`queue`）：作为下一轮输入排进去，目标对话空闲时立刻跑；
- **打断插入**（`steer`）：如果它正在跑，就把这句插进当前这一轮。

走的是 UI 输入框同一条通道（`sessionController.prompt`），所以**冷会话会自动恢复**，消息也会持久化。派完可以直接在详情卡里读最近的用户/助手消息、轮次/工具调用/工具失败/异常轮次统计、最后一次失败原因；也可以一键跳到那个对话看完整上下文。

## 安装

```bash
# 本地目录（开发时）
plugin_manager install_bundle  target=D:\create\dsh-session-console

# 从 GitHub 装（npm 发出来之前也能用）
plugin_manager install_bundle  target=github:onlyinliu/dsh-session-console

# npm 发布之后
plugin_manager install_bundle  target=dsh-session-console
```

装完重开一次 DSH（或关掉再打开插件），侧栏才会出现图标。

## 发布状态与后续步骤

**当前进度**

| 事项 | 状态 |
| --- | --- |
| 源码仓库 | ✅ https://github.com/onlyinliu/dsh-session-console（10 个文件已在 `main`，已加 topic `dsh-plugin`） |
| 插件市场条目 PR | ✅ https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/11917（`data/plugins/onlyinliu__dsh-session-console.yml`，1 commit / 1 file） |
| npm 发布 | ⏸ 待完成：npm 账号开了 2FA，当前 access token 的 `bypass_2fa` 为 `false`，发布被 403 拒绝（见下） |

插件市场（dsh-market）**本身不是插件目录**，列表来自精选仓库
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，
所以「发布」是三件事：**建仓 → 发 npm → 给精选列表提一个 YAML 的 PR**。前两步已完成，只剩 npm。

### 继续发 npm（需要一个人工动作）

拿到的 token 形如 `npm_xxx`，查询其属性会看到 `bypass_2fa: false`。发布时报的是：

```
npm error 403 Forbidden - PUT https://registry.npmjs.org/dsh-session-console
npm error Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

两条出路，任选其一：

1. **推荐**：在 https://www.npmjs.com/settings/onlyinliu7/tokens 新建 Granular Access Token，
   勾上 **Bypass 2FA**，权限给 `Read and write`，把值贴回来即可（本机可写入 `~/.dsh-cred/npm-token`）。
2. 或者提供一次 TOTP 六位码，用 `npm publish --otp=<code>` 发（码 30 秒过期，时效紧）。

发布命令（本机 `~/.npmrc` 的默认 registry 是只读镜像 `registry.npmmirror.com`，必须显式指定官方源）：

```bash
npm publish --registry=https://registry.npmjs.org --access public
```

`npm pack --dry-run` 的产物是 9 个文件 / 32.5 kB，只含 `lib/`、`locale/`、`icon.svg`、
`cordis.patch.yml`、README、LICENSE。

> 包名 `dsh-session-console` 已在 registry 上确认可用（返回 404）；原计划用的
> `dsh-session-admin` 早在 2026-08 就被别人（`jemius`）占用，所以改了名。

### 市场条目（已提交）

`data/plugins/onlyinliu__dsh-session-console.yml` 的内容就是
`D:\create\publish\dsh-session-console.yml`，要点：

- `description.en` 必填、以句号结尾；含 `: `（冒号+空格）时必须整段加引号。
- 一个 PR 最多 3 条；CI 依次查条目数 → `package.json` 的 `dsh.bundle` → 仓库年龄（满 1 天）→ lint 与站点构建。
- **只声明 `dsh.client` 会被拒**——本包已同时声明 `dsh.bundle.patch`，满足条件。
- 条目里**不要**手写 `npm:` 键，映射由站点自动采集。
- 仓库创建于 2026-11-04，CI 的「满 1 天」年龄门槛会在次日自动放行（它会自己重跑，**不需要**关掉 PR 重开）。

### 本机前置条件

| 项 | 现状 |
| --- | --- |
| `git` | 2.56.0 ✅ |
| `npm` / `node` | 10.8.2 / v20.19.6 ✅ |
| `gh` CLI | ❌ 未安装（不需要：GitHub 建仓与提 PR 已用 REST API 完成） |
| GitHub 凭据 | ✅ OAuth token 在 `~/.dsh-cred/github-oauth-token`（device flow 取得，scope `repo,read:org`） |
| npm 凭据 | ⚠️ token 存在 `~/.dsh-cred/npm-token`，但 `bypass_2fa: false`，需按上文换一个 |

## 结构

```
dsh-session-console/
├── package.json         # dsh.bundle.patch + dsh.client 双端声明
├── cordis.patch.yml     # insert: id session-console → name dsh-session-console
├── icon.svg
├── locale/{zh,en}.json  # meta.title / meta.description（插件市场必读）
└── lib/
    ├── index.js         # Host：HTTP 聚合路由 + 5 个 agent tool
    └── client.js        # Client：sidebar.panellist 图标 + main 面板
```

### Host 路由（同源，仅回环地址可访问）

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/plugins/dsh-session-console/overview` | 全量会话行 + 汇总（8s TTL 缓存，并发去重） |
| GET | `/plugins/dsh-session-console/match?q=` | 一句话 → 候选会话 + 是否锁定 |
| GET | `/plugins/dsh-session-console/tail?id=&limit=` | 某会话的最近消息与健康度 |
| POST | `/plugins/dsh-session-console/dispatch` | `{text, sessionId \| query, mode}` → 派任务 |
| POST | `/plugins/dsh-session-console/cancel` | `{sessionId}` → 停止当前轮 |

### Agent 工具（装好即可被任意对话调用）

`session_console_overview`、`session_console_find`、`session_console_tail`、`session_console_dispatch`、`session_console_cancel`。
也就是说：在**任何**对话里说「帮我看看哪些会话最费 token」或「让示例项目那个会话把用例补完」，模型可以直接调它。

## 实现要点

- **不注册新的 session projection**：纯 JS 插件拿不到 zod schema 的声明合并，所以只**读**已有 wire 投影（`title` / `tokenUsage` / `contextPressure` / `sessionListMetadata` / `modelSelection`），聚合放在 Host HTTP 层，8 秒 TTL + inflight 去重。
- **不往会话日志里写新事件类型**：Session 会拒绝重开；派任务复用 `sessionController.prompt`。
- **不用 iframe、不 require `@deepseek-ai/dsh-client-*`**：Client 半边只有一个平台 seed（`react`），所有控件手写，配色全部走 `--dsw-alias-*` 主题 token，light / dark 自动跟随。
- **仅回环**：每个路由都校验 `Host` / `Origin` 与监听地址匹配，`Cache-Control: no-store`。
- 全部注册包在 `ctx.effect(...)` 里并返回清理函数，面板在活动状态下被卸载时会自动 `layout.selectPanel(null)`。

## 已知边界

- 热度公式是启发式的，想改就改 `lib/index.js` 的 `heatOf`。
- 指点只做字面 + 模糊匹配，不做语义 embedding；说「那个改权限的」这类纯意译会落到候选列表让你确认，而不是硬猜。
- 冷会话的第一条派发会触发 resume，可能有一两秒延迟。
- 有些历史会话来自别的机器（`cwd` 指向 `/home/deep/...` 这类本机不存在的路径），它们能读、能显示，但派进去会立刻 `turn/end: blocked`。这类会话在列表里用「空会话 / 冷会话」过滤器可以分开看。
