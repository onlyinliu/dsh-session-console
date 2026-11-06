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

已发布到 npm：

```bash
plugin_manager install_bundle  target=dsh-session-console
```

也可以直接从 GitHub 装：

```bash
plugin_manager install_bundle  target=github:onlyinliu/dsh-session-console
```

开发时从本地目录装（改动即时生效）：

```bash
plugin_manager install_bundle  target=D:\create\dsh-session-console
```

装完重开一次 DSH，侧栏才会出现图标。

> **如果按包名装时报 `declares no dsh.bundle`**：那是镜像还没同步到最新版，
> 解析到了 npm 侧发布时留下的 `0.0.0-stage` 占位版本（它没有 `dsh` 字段）。
> 两种解法：把安装源切到 **npm 官方源**，或者改用 `github:onlyinliu/dsh-session-console`。
> 镜像同步后重试即可（`registry.npmmirror.com/dsh-session-console` 的 `latest` 应为 `0.1.1`）。

> **如果装的时候报 `incompatible-version`（界面上的「与当前 DSH 版本不兼容」）**：装到的是 `0.1.0`。
> 它的 `engines.dsh` 写成了 `>=0.2.0-rc.2 <0.2.2-0`，而按 semver 预发布规则 `0.2.2-rc.1` **大于** `0.2.2-0`，
> 于是被 DSH 判成不兼容。`0.1.1` 已把上界放宽到 `<0.3.0-0`。

### 兼容性（`engines.dsh` 为什么这么写）

DSH 装载插件前会跑 `evaluatePluginCompatibility()`：**只要声明了 `engines.dsh` 就只认它**
（`peerDependencies` 里那些 `@deepseek-ai/dsh-*` 会被忽略），比较时带 `includePrerelease: true`。
所以把上界钉成 `<0.2.2-0` 这种形式，等于每次 DSH 发新 rc 都把插件判成不兼容 —— 这正是 `0.1.0`
在 `0.2.2-rc.1` 上装不上的原因。

`0.1.1` 起：

```json
"engines": { "node": ">=18", "dsh": ">=0.2.0-rc.2 <0.3.0-0" }
```

覆盖 `0.2.0-rc.2` → `0.2.9`（含全部 alpha / rc）。DSH 侧的实际 API 契约在 `0.2.1-rc.5 → 0.2.2-rc.1`
之间没有变化，已逐项比对：`sessionController.list/prompt/cancel`、`SessionSummary` 字段、
`SessionPromptRequest`、`sessionQuery.readSession`、`tokenUsage` / `contextPressure` / `title` /
`sessionListMetadata` / `modelSelection` 五个 projection 的 wire 视图、`webServer.register`、
`tools.register`、`dsh.client` 清单字段、`sidebar.panellist` 与 `main` 两个槽位。

仓库里带了一个不依赖第三方包的复刻脚本 `tools/compat-check.mjs`，可以直接对 `package.json` 跑一遍同样的判定：

```bash
node tools/compat-check.mjs package.json
# dsh-session-console@0.1.1  engines.dsh = ">=0.2.0-rc.2 <0.3.0-0"
#   dsh 0.2.2-rc.1      compatible
#   ...
# ALL_COMPATIBLE
```


## 升级（已经装过旧版）

DSH 对"升级"分两条路，取决于当初是怎么装的：

| 当初的装法 | 有没有「更新」按钮 | 怎么升 |
| --- | --- | --- |
| 包名 `dsh-session-console`（走 npm 注册表） | 有 | 设置 → 插件 → 点开条目 → 详情页头部的「更新到 x.y.z」或下方的「版本」区块 |
| 本地目录 / `link:` / `github:` / tarball | 没有 | 先「移除」，再重新「添加插件」 |

判定规则在 `@deepseek-ai/dsh-plugin-manager` 的 `updateRefusal()`：只有"第三方、装在 profile 里、
以**注册表 spec（自身包名）**保存、清单里有 semver 版本、且不承载插件管理"的包才会被标成可更新。

三个容易踩的点：

- **写精确版本也绕不过去**：已装同名包时 `install_bundle` 直接按包名报 `already-installed`
  （官方文案："to install another version, call remove_bundle first, then install_bundle again"）。
  所以要么用 GUI 的「更新」，要么先移除再装。
- **更新是「先卸后装」**：Host 先移除已装版本让插件停下，再按 `name@version` 装回去。
  目标版本不存在、没声明 `dsh.bundle`、或 `engines.dsh` 不接受当前 DSH 时，更新在检查阶段就被拒，
  profile 不变；装到一半失败会把原版本装回来。
- 本机这种 `link:` 开发安装没有「更新」入口，改完目录里的文件重载插件
  （`set_plugin enabled=false` → `true`）或重启 DSH 即可。

Agent / 命令行侧没有 update 动作，等价操作是：

```
plugin_manager action=remove_bundle  target=dsh-session-console
plugin_manager action=install_bundle target=dsh-session-console
```

写包名就会拿到 `latest`（现在是 `0.1.1`）；**不要**写 `0.1.0`，那一版的 `engines.dsh` 上界太窄，
会被判 `incompatible-version`。

## 发布状态

| 渠道 | 状态 |
| --- | --- |
| 源码仓库 | ✅ <https://github.com/onlyinliu/dsh-session-console>（10 个文件在 `main`，topics 含 `dsh-plugin`） |
| npm | ✅ `dsh-session-console@0.1.1`（2026-11-04，兼容性修复）— <https://www.npmjs.com/package/dsh-session-console> |
| 插件市场条目 | ✅ 已上架 — <https://awesome-dsh-plugin.com/p/onlyinliu/dsh-session-console/>（PR [#11917](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/11917) 于 2026-11-05T20:21Z 合并） |

### 市场 CI 的「仓库年龄」不是错误

`awesome-dsh-plugin` 的 `scripts/check-submission.mjs` 里有 `MIN_AGE_DAYS = 1`：仓库创建不满 1 天直接判失败。
报错文案明说这是唯一失败项、检查会自己重跑放行，**不需要重新提交、push 或关了重开**。
本仓库 `created_at = 2026-11-04T07:19Z`，2026-11-05T18:47Z 的重跑就自动转绿，随后 PR 被合并。

### 上架后 npm 字段还是 null？

站点上的 `npm` / `version` 来自 `data/npm-map.json`，而那是**探针产物**（`scripts/probe-npm.mjs`），
用 `raw.githubusercontent.com` 读仓库 `package.json`、再核对 `registry.npmjs.org` 里该包的 `repository`
是否指回同一仓库。`data/npm-map.json` 被 gitignore、只在 CI 缓存里存在，所以：

- **push 触发**的 `build-site` 是增量模式：它只在 `data/npm-map.json` 缺失或为空时才全量探针；
  命中缓存时只跑 `probe-tarballs` / `probe-capabilities` 等少数几步，新条目的 `npm` 会短暂为 `null`。
- **schedule（`cron: '23 2 * * *'`）与 workflow_dispatch** 才 `full_probe=1`，把所有条目重探一遍。

本次合并后推送触发的构建确实留下了 `"npm": null` / `"version": null`，
下一次夜间构建（UTC 02:23）会自动补上；期间条目功能完全正常，只是安装命令显示成
`dsh plugin --profile web add github:onlyinliu/dsh-session-console` 而不是包名。

### 国内区域为什么慢半拍

`dsh-market` 在中国大陆区域优先读 npm 包 `dsh-plugin-catalog`，而它只在 `build-site` 的
`schedule` / `workflow_dispatch` 分支发布（`if: github.event_name == 'schedule' || ...`）。
所以国内目录最迟滞后到次日夜间。急着看可以到「市场设置 → 下载区域」切「全球」，
或直接把安装源写成 npm 官方源。

### 以后发新版本

1. 改 `package.json` 的 `version`；
2. 发布必须用**勾了 Bypass 2FA 的 Granular Access Token**（这类 token 直接 publish 仍可用到 2027-01，之后要迁 trusted publishing）：

```bash
printf 'registry=https://registry.npmjs.org/\n//registry.npmjs.org/:_authToken=npm_xxx\n' > /tmp/rc
npm publish --userconfig /tmp/rc --registry=https://registry.npmjs.org --access public
```

> 本机 `~/.npmrc` 的默认 registry 是 `registry.npmmirror.com`（只读镜像，**不能 publish**），
> 所以必须显式带 `--registry=https://registry.npmjs.org`。
> 发布返回 `202` 后，版本元数据先出现、tarball 在 CDN 上还有几秒到几十秒延迟，属正常。

3. 把源码同步到 GitHub。本机到 `github.com:443` 的 git 连接不稳定（`Recv failure: Connection was reset`），
   可以改用 REST Contents API 逐文件 `PUT /repos/<owner>/dsh-session-console/contents/<path>` 推送。

### 市场条目规则（已按此写好并提 PR）

- 文件位置 `data/plugins/<owner>__<repo>.yml`，一个插件一个文件；README 是生成的，**别手改**。
- `description.en` 必填、以句号结尾；含 `: `（冒号+空格）要整段加引号。
- CI 依次查：条目数（一个 PR 最多 3 条）→ `package.json` 必须声明 `dsh.bundle`（**只声明 `dsh.client` 会被拒**）→ 仓库满 1 天 → lint 与站点构建。
- 条目里**不要**手写 `npm:` 键，映射由站点自动采集；npm 包的 `repository` 必须指回列表里的仓库。
- 合并后站点与 dsh-market 通常一天内收录。

## 本机前置条件

| 项 | 现状 |
| --- | --- |
| `git` | 2.56.0 ✅ |
| `npm` / `node` | 10.8.2 / v20.19.6 ✅ |
| `gh` CLI | ❌ 未安装 —— 建仓走了 GitHub Device Flow + REST API，不需要它 |
| 发布凭据 | 不在仓库里：GitHub 用 device flow 换的 OAuth token，npm 用勾了 Bypass 2FA 的 Granular Token |

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

## 版本记录

| 版本 | 变更 |
| --- | --- |
| `0.1.1` | **兼容性修复**：`engines.dsh` 从 `>=0.2.0-rc.2 <0.2.2-0` 放宽到 `>=0.2.0-rc.2 <0.3.0-0`。原来那个上界会让 `0.2.2-alpha.3` / `0.2.2-rc.1` / `0.2.2` 全部被判为 `incompatible-version`，装不上。同时补了 `tools/compat-check.mjs`（复刻 DSH 的判定逻辑）并把兼容性说明写进 README。 |
| `0.1.0` | 首个发布版：仪表盘 + 一句话指代 + 跨会话派任务 + 5 个 agent 工具。 |
