// dsh-session-console — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-session-console/client.js and
// executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). The factory body is plain CJS with
// require() resolved against the shell's module table.
//
// Two surfaces, one id:
//   * `sidebar.panellist` id "session-console" — the sidebar icon that owns the
//     entry ("each list id addresses the matching main panel").
//   * `main` key "session-console" — the dashboard panel itself.
//
// Data comes from this package's own Host half over same-origin HTTP
// (`/plugins/dsh-session-console/*`), which is the only channel a plain-JS
// client bundle has. Nothing here requires a `@deepseek-ai/dsh-client-*`
// package: React is the single platform seed, and every control is written
// from scratch against `--dsw-alias-*` theme tokens.

window.__ModuleLoader__.load({
	id: "dsh-session-console",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let React = null;
		try {
			React = require("react");
		} catch (error) {
			React = null;
		}
		if (React === null || typeof React.createElement !== "function") {
			// Stay invisible instead of taking the web shell down.
			try {
				console.warn("[dsh-session-console] react is unavailable — plugin disabled for this session");
			} catch {}
			exports.apply = () => {};
			exports.inject = [];
			return module.exports;
		}

		const h = React.createElement;
		const useState = React.useState;
		const useEffect = React.useEffect;
		const useMemo = React.useMemo;
		const useCallback = React.useCallback;
		const useRef = React.useRef;

		/** Locale namespace; also the dictionaries' own key. */
		const NS = "dsh-session-console";
		/** Sidebar entry id === main panel key. */
		const PANEL_ID = "session-console";
		/** Refresh cadence for the overview poll. */
		const DEFAULT_INTERVAL_MS = 12000;

		/* ---------------------------------------------------------------- */
		/* Dictionary                                                       */
		/* ---------------------------------------------------------------- */

		const ZH = {
			nav: "会话总控",
			title: "会话总控",
			subtitle: "左侧全部对话的管理员：状态、消耗、热度一眼看完，说一句话就能指到某个对话、派任务、看返回。",
			refresh: "刷新",
			auto: "自动刷新",
			updatedAt: "更新于",
			failed: "读取失败",
			loading: "加载中…",
			retry: "重试",
			/* KPIs */
			kpiSessions: "会话总数",
			kpiRunning: "运行中",
			kpiTokens: "累计 token",
			kpiCache: "缓存命中率",
			kpiToday: "今日活跃",
			kpiCold: "冷会话",
			kpiHottest: "最热",
			kpiProjects: "工作区",
			/* console */
			consoleTitle: "指代与派任务",
			consoleHint: "像说话一样指代目标对话，例如「示例项目的相关内容怎么样了」。",
			consolePlaceholder: "示例项目的相关内容怎么样了",
			locate: "定位",
			locating: "定位中…",
			subject: "识别主语",
			confident: "唯一目标",
			needConfirm: "需要确认",
			noMatch: "没有匹配到会话。",
			useThis: "设为目标",
			peek: "看返回",
			openConv: "打开对话",
			target: "目标",
			targetNone: "未选择目标——先在上面定位，或直接点右侧列表里的一行。",
			clearTarget: "清除",
			commandLabel: "要派给这个对话的话",
			commandPlaceholder: "例如：把示例项目的接口用例补一遍，然后告诉我结果。",
			modeQueue: "排队",
			modeSteer: "打断插入",
			send: "派发",
			sending: "派发中…",
			stop: "停止",
			dispatched: "已派发",
			cancelled: "已停止",
			openFailed: "打开对话失败",
			needCommand: "请先写要派发的内容。",
			needTarget: "还没有目标对话——先定位一个，或点列表里的一行。",
			/* list */
			listTitle: "会话列表",
			searchPlaceholder: "按标题 / 路径过滤…",
			filterAll: "全部",
			filterRunning: "运行中",
			filterToday: "今日",
			filterCold: "冷会话",
			filterBlank: "空会话",
			sortHeat: "热度",
			sortTokens: "消耗",
			sortRecent: "最近",
			empty: "没有符合条件的会话。",
			colSession: "会话",
			colHeat: "热度",
			colTokens: "token",
			colState: "状态",
			stateRunning: "运行中",
			stateIdle: "空闲",
			stateCold: "冷",
			stateBlank: "空白",
			untitled: "未命名",
			/* detail */
			detailTitle: "最近返回",
			detailEmpty: "在上面的列表里点一行，这里显示它最近的对话与健康度。",
			detailLoading: "读取中…",
			turns: "轮次",
			steps: "步数",
			toolCalls: "工具调用",
			toolErrors: "工具失败",
			failures: "异常轮次",
			lastFailure: "最后一次失败",
			events: "事件",
			pressure: "上下文压力",
			model: "模型",
			inline: "发送到该对话",
			projects: "按工作区",
			messages: "最近消息",
			noMessages: "暂无消息。",
			user: "用户",
			assistant: "助手",
			score: "分数",
			eventsUnit: "事件",
			sessionsUnit: "会话",
			runningUnit: "运行",
			hintOut: "出",
			hintRead: "读",
			hintWeek: "周",
			agoJust: "刚刚",
			agoMin: " 分钟前",
			agoHour: " 小时前",
			agoDay: " 天前",
			agoMonth: " 个月前",
		};

		const EN = {
			nav: "Session Console",
			title: "Session Console",
			subtitle: "An administrator for every conversation in the sidebar: status, spend and heat at a glance — one sentence targets a conversation, dispatches a task, and reads the result back.",
			refresh: "Refresh",
			auto: "Auto",
			updatedAt: "Updated",
			failed: "Read failed",
			loading: "Loading…",
			retry: "Retry",
			kpiSessions: "Sessions",
			kpiRunning: "Running",
			kpiTokens: "Tokens",
			kpiCache: "Cache hit",
			kpiToday: "Active today",
			kpiCold: "Cold",
			kpiHottest: "Hottest",
			kpiProjects: "Workspaces",
			consoleTitle: "Target & dispatch",
			consoleHint: "Address a conversation the way you would say it, e.g. \"how is the example project going\".",
			consolePlaceholder: "how is the example project going",
			locate: "Locate",
			locating: "Locating…",
			subject: "Subject",
			confident: "Unique match",
			needConfirm: "Needs confirmation",
			noMatch: "No conversation matched.",
			useThis: "Set target",
			peek: "Read back",
			openConv: "Open",
			target: "Target",
			targetNone: "No target yet — locate above, or click a row in the list.",
			clearTarget: "Clear",
			commandLabel: "What to send to this conversation",
			commandPlaceholder: "e.g. Finish the example project API tests, then report back.",
			modeQueue: "Queue",
			modeSteer: "Steer",
			send: "Dispatch",
			sending: "Dispatching…",
			stop: "Stop",
			dispatched: "Dispatched",
			cancelled: "Stopped",
			openFailed: "Could not open the conversation",
			needCommand: "Write what you want to dispatch first.",
			needTarget: "No target yet — locate one, or click a row in the list.",
			listTitle: "Conversations",
			searchPlaceholder: "Filter by title / path…",
			filterAll: "All",
			filterRunning: "Running",
			filterToday: "Today",
			filterCold: "Cold",
			filterBlank: "Empty",
			sortHeat: "Heat",
			sortTokens: "Spend",
			sortRecent: "Recent",
			empty: "Nothing matches the current filter.",
			colSession: "Conversation",
			colHeat: "Heat",
			colTokens: "tokens",
			colState: "State",
			stateRunning: "running",
			stateIdle: "idle",
			stateCold: "cold",
			stateBlank: "blank",
			untitled: "Untitled",
			detailTitle: "Latest activity",
			detailEmpty: "Click a row above to see its recent messages and health here.",
			detailLoading: "Loading…",
			turns: "turns",
			steps: "steps",
			toolCalls: "tool calls",
			toolErrors: "tool errors",
			failures: "failed turns",
			lastFailure: "Last failure",
			events: "events",
			pressure: "Context pressure",
			model: "Model",
			inline: "Send to this conversation",
			projects: "By workspace",
			messages: "Recent messages",
			noMessages: "No messages yet.",
			user: "user",
			assistant: "assistant",
			score: "score",
			eventsUnit: "events",
			sessionsUnit: "sessions",
			runningUnit: "running",
			hintOut: "out",
			hintRead: "read",
			hintWeek: "week",
			agoJust: "just now",
			agoMin: "m ago",
			agoHour: "h ago",
			agoDay: "d ago",
			agoMonth: "mo ago",
		};

		/* ---------------------------------------------------------------- */
		/* Stylesheet                                                       */
		/* ---------------------------------------------------------------- */

		const STYLE_ID = "dsh-session-console/css";

		const CSS = `
.dsc-panelHost{box-sizing:border-box;height:100%;min-height:0;padding:calc(18px + var(--dsh-frame-top-clearance, 0px)) 0 0;display:flex;flex-direction:column;overflow:hidden}
.dsc-root{box-sizing:border-box;flex:1;min-height:0;width:100%;max-width:1360px;margin:0 auto;padding:0 24px 32px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;overscroll-behavior:contain}
.dsc-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap}
.dsc-headText{flex:1;min-width:240px}
.dsc-h1{margin:0;font-size:19px;line-height:26px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2328)}
.dsc-sub{margin:4px 0 0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-tertiary,#8b93a1)}
.dsc-headTools{display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap}
.dsc-stamp{font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8b93a1);font-variant-numeric:tabular-nums}
.dsc-btn{box-sizing:border-box;font:inherit;font-size:12px;line-height:18px;height:28px;padding:0 11px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:border-color .15s,background .15s}
.dsc-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l3,#d9dde3);background:var(--dsw-alias-bg-layer-2,#f5f6f8)}
.dsc-btn:disabled{cursor:default;opacity:.5}
.dsc-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4f6ef7);outline-offset:1px}
.dsc-btnPrimary{border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4f6ef7));color:var(--dsw-alias-label-primary-foreground,#fff)}
.dsc-btnPrimary:hover:not(:disabled){background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#4f6ef7));border-color:transparent;filter:brightness(1.06)}
.dsc-btnDanger{color:var(--dsw-alias-state-error-primary,#dc2626)}
.dsc-btnTiny{height:22px;padding:0 8px;font-size:11.5px;line-height:16px;border-radius:6px}
.dsc-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer;user-select:none}
.dsc-toggle input{margin:0;accent-color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dsc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px}
.dsc-kpi{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:11px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.dsc-kpiLabel{font-size:11.5px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsc-kpiValue{font-size:18px;line-height:24px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2328);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsc-kpiHint{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsc-kpiAccent .dsc-kpiValue{color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dsc-cols{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:14px;align-items:start}
@media (max-width:1080px){.dsc-cols{grid-template-columns:minmax(0,1fr)}}
.dsc-card{background:var(--dsw-alias-bg-layer-1,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;display:flex;flex-direction:column;min-width:0;overflow:hidden}
.dsc-cardHead{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);flex-wrap:wrap}
.dsc-cardTitle{font-size:13px;line-height:18px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2328);margin:0}
.dsc-cardBody{padding:12px;display:flex;flex-direction:column;gap:10px;min-width:0}
.dsc-grow{flex:1}
.dsc-input,.dsc-textarea{box-sizing:border-box;width:100%;min-width:0;font:inherit;font-size:13px;line-height:19px;padding:7px 9px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d9dde3);background:var(--dsw-alias-bg-layer-3,#fff);color:var(--dsw-alias-label-primary,#1f2328)}
.dsc-input::placeholder,.dsc-textarea::placeholder{color:var(--dsw-alias-label-tertiary,#9ca3af)}
.dsc-input:focus,.dsc-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4f6ef7);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-brand-primary,#4f6ef7) 16%, transparent)}
.dsc-textarea{resize:vertical;min-height:64px}
.dsc-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dsc-hint{font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary,#8b93a1);margin:0}
.dsc-chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:22px;padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);color:var(--dsw-alias-label-secondary,#6b7280);font-size:11.5px;line-height:17px}
.dsc-chipLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsc-chipBrand{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4f6ef7) 12%, transparent);color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dsc-chipX{border:0;background:0 0;color:inherit;cursor:pointer;font:inherit;line-height:1;padding:0 0 0 2px;opacity:.7}
.dsc-chipX:hover{opacity:1}
.dsc-cand{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:9px;padding:7px 9px;display:flex;align-items:center;gap:8px;min-width:0;background:var(--dsw-alias-bg-layer-1,#fff)}
.dsc-candSel{border-color:var(--dsw-alias-brand-primary,#4f6ef7);background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4f6ef7) 7%, var(--dsw-alias-bg-layer-1,#fff))}
.dsc-candMain{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}
.dsc-candTitle{font-size:12.5px;line-height:18px;color:var(--dsw-alias-label-primary,#1f2328);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsc-candMeta{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsc-list{display:flex;flex-direction:column;min-width:0}
.dsc-listHead,.dsc-item{display:grid;grid-template-columns:minmax(0,1fr) 70px 78px 84px;gap:10px;align-items:center;padding:7px 12px;min-width:0}
.dsc-listHead{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1);border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);padding-bottom:6px}
.dsc-item{border-bottom:1px solid var(--dsw-alias-border-l2,#f0f1f3);cursor:pointer;font-size:12.5px;color:var(--dsw-alias-label-primary,#1f2328)}
.dsc-item:hover{background:var(--dsw-alias-bg-layer-2,#f7f8fa)}
.dsc-itemActive{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4f6ef7) 8%, transparent)}
.dsc-itemActive:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#4f6ef7) 12%, transparent)}
.dsc-itemMain{display:flex;align-items:center;gap:7px;min-width:0}
.dsc-dot{width:7px;height:7px;border-radius:999px;flex:none;background:var(--dsw-alias-label-tertiary,#9ca3af)}
.dsc-dotRun{background:var(--dsw-alias-state-success-primary,#22c55e);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 18%, transparent)}
.dsc-dotCold{background:var(--dsw-alias-label-dimmed,#c8ccd4)}
.dsc-dotBlank{background:transparent;border:1.5px solid var(--dsw-alias-label-tertiary,#9ca3af)}
.dsc-itemBlank{opacity:.62}
.dsc-itemBlank .dsc-itemTitle{font-style:italic}
.dsc-itemText{min-width:0;display:flex;flex-direction:column;gap:0}
.dsc-itemTitle{font-size:12.5px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsc-itemMeta{font-size:11px;line-height:15px;color:var(--dsw-alias-label-tertiary,#8b93a1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsc-num{font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;text-align:right}
.dsc-heat{display:flex;align-items:center;gap:6px;min-width:0}
.dsc-heatTrack{flex:1;height:5px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#eef0f4);overflow:hidden;min-width:20px}
.dsc-heatFill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--dsw-alias-brand-primary,#4f6ef7),color-mix(in srgb, var(--dsw-alias-state-warn-primary,#b45309) 70%, var(--dsw-alias-brand-primary,#4f6ef7)))}
.dsc-state{font-size:11px;line-height:16px;padding:1px 7px;border-radius:5px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);color:var(--dsw-alias-label-secondary,#6b7280);white-space:nowrap;justify-self:end}
.dsc-stateRun{background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#22c55e) 14%, transparent);color:var(--dsw-alias-state-success-primary,#16a34a)}
.dsc-tabs{display:inline-flex;gap:2px;padding:2px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,#f3f4f6);border:1px solid var(--dsw-alias-border-l2,#e5e7eb)}
.dsc-tab{font:inherit;font-size:11.5px;line-height:16px;padding:3px 9px;border-radius:6px;border:0;background:0 0;color:var(--dsw-alias-label-secondary,#6b7280);cursor:pointer}
.dsc-tabOn{background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#1f2328);font-weight:600;box-shadow:var(--dsw-shadow-lv1,0 1px 2px #1f232814)}
.dsc-empty{padding:22px 12px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-tertiary,#8b93a1)}
.dsc-err{font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary,#dc2626);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#dc2626) 8%, transparent);border-radius:8px;padding:7px 9px;white-space:pre-wrap;overflow-wrap:anywhere}
.dsc-ok{font-size:12px;line-height:18px;color:var(--dsw-alias-state-success-primary,#16a34a);background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#16a34a) 9%, transparent);border-radius:8px;padding:7px 9px;overflow-wrap:anywhere}
.dsc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(86px,1fr));gap:8px}
.dsc-stat{background:var(--dsw-alias-bg-layer-2,#f7f8fa);border-radius:8px;padding:6px 9px;min-width:0}
.dsc-statLabel{font-size:10.5px;line-height:14px;color:var(--dsw-alias-label-tertiary,#8b93a1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsc-statValue{font-size:13px;line-height:18px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#1f2328)}
.dsc-msgs{display:flex;flex-direction:column;gap:8px}
.dsc-msg{border-left:2px solid var(--dsw-alias-border-l3,#d9dde3);padding:0 0 0 9px;min-width:0}
.dsc-msgUser{border-left-color:var(--dsw-alias-brand-primary,#4f6ef7)}
.dsc-msgHead{display:flex;align-items:baseline;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary,#8b93a1)}
.dsc-msgRole{font-weight:600;color:var(--dsw-alias-label-secondary,#6b7280)}
.dsc-msgText{margin:2px 0 0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-primary,#1f2328);white-space:pre-wrap;overflow-wrap:anywhere;max-height:132px;overflow:hidden}
.dsc-proj{display:flex;flex-direction:column;gap:5px}
.dsc-projRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;font-size:11.5px;color:var(--dsw-alias-label-secondary,#6b7280)}
.dsc-projName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dsc-projBar{height:4px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#eef0f4);overflow:hidden;grid-column:1/-1}
.dsc-projFill{height:100%;background:var(--dsw-alias-brand-primary,#4f6ef7);border-radius:999px}
.dsc-skel{height:11px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,#eef0f4);animation:dsaPulse 1.2s ease-in-out infinite}
@keyframes dsaPulse{0%,100%{opacity:1}50%{opacity:.45}}
@media (prefers-reduced-motion:reduce){.dsc-skel{animation:none}}
`;

		function ensureStyle() {
			if (typeof document === "undefined") return null;
			try {
				const existing = document.getElementById(STYLE_ID);
				if (existing !== null) return existing;
				const el = document.createElement("style");
				el.id = STYLE_ID;
				el.textContent = CSS;
				(document.head || document.body).appendChild(el);
				return el;
			} catch (error) {
				return null;
			}
		}

		/* ---------------------------------------------------------------- */
		/* Host channel                                                     */
		/* ---------------------------------------------------------------- */

		/** Same-origin path anchored on the document base, query preserved. */
		function api(path) {
			const relative = String(path).replace(/^\/+/u, "");
			if (typeof document === "undefined") return `/${relative}`;
			try {
				const url = new URL(relative, document.baseURI);
				return `${url.pathname}${url.search}`;
			} catch (error) {
				return `/${relative}`;
			}
		}

		async function request(path, init) {
			const response = await fetch(api(path), {
				cache: "no-store",
				credentials: "same-origin",
				...init,
			});
			const raw = await response.text();
			let body = {};
			if (raw.length > 0) {
				try {
					body = JSON.parse(raw);
				} catch (error) {
					body = { error: raw.slice(0, 300) };
				}
			}
			if (!response.ok) {
				const failure = new Error(
					typeof body?.error === "string" && body.error.length > 0 ? body.error : `HTTP ${response.status}`,
				);
				failure.status = response.status;
				failure.body = body;
				throw failure;
			}
			return body;
		}

		function postJson(path, payload) {
			return request(path, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload ?? {}),
			});
		}

		/* ---------------------------------------------------------------- */
		/* Formatting                                                       */
		/* ---------------------------------------------------------------- */

		function fmtTokens(value) {
			const n = Number(value) || 0;
			if (n < 1000) return String(n);
			if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
			return `${(n / 1_000_000).toFixed(2)}M`;
		}

		// `modelSelection.next.model` is sometimes already namespaced by the
		// provider it came through (e.g. provider "magpie" reports model
		// "workbuddy/deepseek-v4.1-flash"), so only prefix the provider when the
		// model name does not already carry it.
		function modelLabel(row) {
			const model = row?.model;
			if (typeof model !== "string" || model.length === 0) return "";
			const provider = typeof row?.provider === "string" ? row.provider : "";
			if (provider.length === 0 || model === provider || model.startsWith(`${provider}/`)) return model;
			return `${provider}/${model}`;
		}

		function fmtAgo(time, t) {
			if (typeof time !== "number" || time <= 0) return "";
			const delta = Date.now() - time;
			if (delta < 45_000) return t("agoJust");
			const minutes = Math.round(delta / 60_000);
			if (minutes < 60) return `${minutes}${t("agoMin")}`;
			const hours = Math.round(minutes / 60);
			if (hours < 24) return `${hours}${t("agoHour")}`;
			const days = Math.round(hours / 24);
			if (days < 30) return `${days}${t("agoDay")}`;
			return `${Math.round(days / 30)}${t("agoMonth")}`;
		}

		function fmtClock(time) {
			if (typeof time !== "number" || time <= 0) return "";
			try {
				return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
			} catch (error) {
				return "";
			}
		}

		function fmtDate(time) {
			if (typeof time !== "number" || time <= 0) return "";
			try {
				return new Date(time).toLocaleDateString();
			} catch (error) {
				return "";
			}
		}

		function shortId(id) {
			return typeof id === "string" ? id.slice(0, 8) : "";
		}

		function stateOf(row, t) {
			if (row.running === true) return { key: "run", label: t("stateRunning") };
			if (row.blank === true) return { key: "blank", label: t("stateBlank") };
			if (row.agentAvailable === false) return { key: "cold", label: t("stateCold") };
			return { key: "idle", label: t("stateIdle") };
		}

		/* ---------------------------------------------------------------- */
		/* Small presentational pieces                                      */
		/* ---------------------------------------------------------------- */

		function Kpi({ label, value, hint, accent }) {
			return h(
				"div",
				{ className: accent === true ? "dsc-kpi dsc-kpiAccent" : "dsc-kpi" },
				h("div", { className: "dsc-kpiLabel" }, label),
				h("div", { className: "dsc-kpiValue" }, value),
				hint === undefined ? null : h("div", { className: "dsc-kpiHint" }, hint),
			);
		}

		function HeatCell({ heat, max }) {
			const peak = max > 0 ? max : 1;
			const pct = Math.max(2, Math.min(100, Math.round((Number(heat) || 0) / peak * 100)));
			return h(
				"div",
				{ className: "dsc-heat", title: `heat ${heat}` },
				h("div", { className: "dsc-heatTrack" }, h("div", { className: "dsc-heatFill", style: { width: `${pct}%` } })),
				h("span", { className: "dsc-num", style: { minWidth: "30px" } }, String(Math.round((Number(heat) || 0) * 10) / 10)),
			);
		}

		function ProjectRollup({ projects, t }) {
			const list = Array.isArray(projects) ? projects.slice(0, 6) : [];
			if (list.length === 0) return null;
			const peak = list.reduce((max, entry) => Math.max(max, Number(entry.tokens) || 0), 0) || 1;
			return h(
				"div",
				{ className: "dsc-proj" },
				list.map((entry) => {
					const pct = Math.max(2, Math.min(100, Math.round((Number(entry.tokens) || 0) / peak * 100)));
					const suffix = entry.running > 0 ? ` · ${entry.running} ${t("runningUnit")}` : "";
					return h(
						"div",
						{ key: entry.cwd ?? entry.leaf, className: "dsc-projRow" },
						h(
							"span",
							{ className: "dsc-projName", title: entry.cwd ?? "" },
							`${entry.leaf ?? entry.cwd} · ${entry.sessions} ${t("sessionsUnit")}${suffix}`,
						),
						h("span", { className: "dsc-num" }, fmtTokens(entry.tokens)),
						h("div", { className: "dsc-projBar" }, h("div", { className: "dsc-projFill", style: { width: `${pct}%` } })),
					);
				}),
			);
		}

		/* ---------------------------------------------------------------- */
		/* Dashboard                                                        */
		/* ---------------------------------------------------------------- */

		function Dashboard(props) {
			const t = typeof props.t === "function" ? props.t : (key) => ZH[key] ?? key;
			const ctx = props.ctx;
			const [overview, setOverview] = useState({ data: null, error: null, loading: true });
			const [auto, setAuto] = useState(true);
			const [filter, setFilter] = useState("all");
			const [sort, setSort] = useState("heat");
			const [needle, setNeedle] = useState("");
			const [matchState, setMatchState] = useState({ subject: "", candidates: [], confident: false, best: null });
			const [matchBusy, setMatchBusy] = useState(false);
			const [matchError, setMatchError] = useState(null);
			const [locateText, setLocateText] = useState("");
			const [target, setTarget] = useState(null);
			const [command, setCommand] = useState("");
			const [mode, setMode] = useState("queue");
			const [sendBusy, setSendBusy] = useState(false);
			const [notice, setNotice] = useState(null);
			const [detail, setDetail] = useState({ id: null, data: null, error: null, loading: false });
			const aliveRef = useRef(true);

			useEffect(() => {
				aliveRef.current = true;
				return () => {
					aliveRef.current = false;
				};
			}, []);

			const load = useCallback(async () => {
				try {
					const data = await request("/plugins/dsh-session-console/overview");
					if (!aliveRef.current) return;
					setOverview({ data, error: null, loading: false });
				} catch (error) {
					if (!aliveRef.current) return;
					setOverview((previous) => ({ data: previous.data, error: String(error?.message ?? error), loading: false }));
				}
			}, []);

			useEffect(() => {
				load();
			}, [load]);

			useEffect(() => {
				if (!auto) return undefined;
				const handle = setInterval(() => {
					if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
					load();
				}, DEFAULT_INTERVAL_MS);
				return () => clearInterval(handle);
			}, [auto, load]);

			const rows = overview.data?.sessions ?? [];
			const totals = overview.data?.totals ?? {};
			const heatMax = rows.reduce((max, row) => Math.max(max, Number(row.heat) || 0), 0);

			const visible = useMemo(() => {
				const cutoff = Date.now() - 86_400_000;
				const lower = needle.trim().toLowerCase();
				let list = rows.filter((row) => {
					if (filter === "running" && row.running !== true) return false;
					if (filter === "today" && !(row.running === true || (Number(row.updatedAt) || 0) >= cutoff)) return false;
					if (filter === "cold" && (row.agentAvailable !== false || row.blank === true)) return false;
					if (filter === "blank" && row.blank !== true) return false;
					if (lower.length > 0) {
						const haystack = `${row.title ?? ""} ${row.cwd ?? ""} ${row.id ?? ""}`.toLowerCase();
						if (!haystack.includes(lower)) return false;
					}
					return true;
				});
				list = list.slice();
				if (sort === "tokens") list.sort((a, b) => (b.tokens?.total ?? 0) - (a.tokens?.total ?? 0));
				else if (sort === "recent") list.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
				// Default ordering keeps never-used sessions (blank) at the bottom:
				// they carry no history, so they should not outrank real conversations
				// just because they are recent.
				else
					list.sort(
						(a, b) =>
							Number(a.blank === true) - Number(b.blank === true) || (b.heat ?? 0) - (a.heat ?? 0),
					);
				return list;
			}, [rows, filter, sort, needle]);

			const runMatch = useCallback(async (text) => {
				const query = String(text ?? "").trim();
				if (query.length === 0) return;
				setMatchBusy(true);
				setMatchError(null);
				try {
					const data = await request(`/plugins/dsh-session-console/match?q=${encodeURIComponent(query)}&limit=6`);
					if (!aliveRef.current) return;
					setMatchState({
						subject: data?.subject ?? "",
						candidates: data?.candidates ?? [],
						confident: data?.confident === true,
						best: data?.best ?? null,
					});
					const best = data?.best;
					if (data?.confident === true && best !== null && best !== undefined) {
						setTarget({ id: best.id, title: best.title });
					}
				} catch (error) {
					if (!aliveRef.current) return;
					setMatchError(String(error?.message ?? error));
					setMatchState({ subject: "", candidates: [], confident: false, best: null });
				} finally {
					if (aliveRef.current) setMatchBusy(false);
				}
			}, []);

			const loadDetail = useCallback(async (sessionId) => {
				if (typeof sessionId !== "string" || sessionId.length === 0) return;
				setDetail({ id: sessionId, data: null, error: null, loading: true });
				try {
					const data = await request(`/plugins/dsh-session-console/tail?id=${encodeURIComponent(sessionId)}&limit=12`);
					if (!aliveRef.current) return;
					setDetail({ id: sessionId, data, error: null, loading: false });
				} catch (error) {
					if (!aliveRef.current) return;
					setDetail({ id: sessionId, data: null, error: String(error?.message ?? error), loading: false });
				}
			}, []);

			const selectRow = useCallback(
				(row) => {
					setTarget({ id: row.id, title: row.title });
					loadDetail(row.id);
				},
				[loadDetail],
			);

			const openConversation = useCallback(
				(row) => {
					const sessionId = typeof row === "string" ? row : row?.id;
					if (typeof sessionId !== "string" || sessionId.length === 0) return;
					try {
						const layout = ctx?.get?.("layout");
						if (layout?.panelInfo?.getSnapshot?.().activePanelId === PANEL_ID) layout.selectPanel(null);
					} catch (error) {
						/* panel switch is best effort */
					}
					try {
						const workspace = ctx?.get?.("uiWorkspace");
						if (typeof workspace?.openSession === "function") {
							workspace.openSession(sessionId);
						} else if (typeof window !== "undefined") {
							window.location.hash = `#/session/${encodeURIComponent(sessionId)}`;
						}
					} catch (error) {
						setNotice({ kind: "err", text: `${t("openFailed")}: ${String(error?.message ?? error)}` });
					}
				},
				[ctx],
			);

			const send = useCallback(async () => {
				const text = command.trim();
				if (text.length === 0) {
					setNotice({ kind: "err", text: t("needCommand") });
					return;
				}
				if (target === null) {
					setNotice({ kind: "err", text: t("needTarget") });
					return;
				}
				setSendBusy(true);
				setNotice(null);
				try {
					const result = await postJson("/plugins/dsh-session-console/dispatch", {
						text,
						sessionId: target.id,
						mode,
					});
					if (!aliveRef.current) return;
					setNotice({
						kind: "ok",
						text: `${t("dispatched")} → ${target.title ?? shortId(target.id)}（${result?.mode ?? mode}）`,
					});
					setCommand("");
					load();
					loadDetail(target.id);
				} catch (error) {
					if (!aliveRef.current) return;
					const candidates = Array.isArray(error?.body?.candidates) ? error.body.candidates : null;
					setNotice({ kind: "err", text: String(error?.message ?? error) });
					if (candidates !== null) setMatchState((previous) => ({ ...previous, candidates }));
				} finally {
					if (aliveRef.current) setSendBusy(false);
				}
			}, [command, target, mode, load, loadDetail, t]);

			const stopOne = useCallback(
				async (sessionId) => {
					try {
						await postJson("/plugins/dsh-session-console/cancel", { sessionId });
						if (!aliveRef.current) return;
						setNotice({ kind: "ok", text: `${t("cancelled")} → ${shortId(sessionId)}` });
						load();
					} catch (error) {
						if (!aliveRef.current) return;
						setNotice({ kind: "err", text: String(error?.message ?? error) });
					}
				},
				[load, t],
			);

			const stamp = overview.data?.at;
			const headTools = h(
				"div",
				{ className: "dsc-headTools" },
				stamp === undefined ? null : h("span", { className: "dsc-stamp" }, `${t("updatedAt")} ${fmtClock(stamp)}`),
				h(
					"label",
					{ className: "dsc-toggle" },
					h("input", {
						type: "checkbox",
						checked: auto,
						onChange: (event) => setAuto(event.target.checked === true),
					}),
					t("auto"),
				),
				h(
					"button",
					{ type: "button", className: "dsc-btn", onClick: () => load(), disabled: overview.loading === true },
					t("refresh"),
				),
			);

			const kpis = h(
				"div",
				{ className: "dsc-kpis" },
				h(Kpi, { label: t("kpiSessions"), value: String(totals.sessions ?? rows.length), hint: `${t("kpiProjects")} ${Array.isArray(totals.projects) ? totals.projects.length : 0}` }),
				h(Kpi, { label: t("kpiRunning"), value: String(totals.running ?? 0), hint: `${t("kpiCold")} ${totals.cold ?? 0}`, accent: (totals.running ?? 0) > 0 }),
				h(Kpi, { label: t("kpiTokens"), value: fmtTokens(totals.tokens ?? 0), hint: `${t("hintOut")} ${fmtTokens(totals.tokensOutput ?? 0)}` }),
				h(Kpi, { label: t("kpiCache"), value: `${totals.cacheHitRate ?? 0}%`, hint: `${t("hintRead")} ${fmtTokens(totals.tokensCacheRead ?? 0)}` }),
				h(Kpi, { label: t("kpiToday"), value: String(totals.activeToday ?? 0), hint: `${t("hintWeek")} ${totals.activeWeek ?? 0}` }),
				h(Kpi, {
					label: t("kpiHottest"),
					value: totals.hottest === undefined || totals.hottest === null ? "—" : String(totals.hottest.heat),
					hint: totals.hottest?.title ?? "",
				}),
			);

			/* ---- target console ---- */
			const consoleCard = h(
				"section",
				{ className: "dsc-card" },
				h(
					"div",
					{ className: "dsc-cardHead" },
					h("h2", { className: "dsc-cardTitle" }, t("consoleTitle")),
					h("span", { className: "dsc-hint dsc-grow" }, t("consoleHint")),
				),
				h(
					"div",
					{ className: "dsc-cardBody" },
					h(
						"div",
						{ className: "dsc-row" },
						h("input", {
							className: "dsc-input dsc-grow",
							type: "text",
							value: locateText,
							placeholder: t("consolePlaceholder"),
							onChange: (event) => setLocateText(event.target.value),
							onKeyDown: (event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									runMatch(event.currentTarget.value);
								}
							},
							id: "dsc-locate-input",
						}),
						h(
							"button",
							{
								type: "button",
								className: "dsc-btn dsc-btnPrimary",
								disabled: matchBusy,
								onClick: () => runMatch(locateText),
							},
							matchBusy ? t("locating") : t("locate"),
						),
					),
					matchError === null ? null : h("div", { className: "dsc-err" }, matchError),
					matchState.subject.length > 0 && matchState.candidates.length === 0
						? h("div", { className: "dsc-hint" }, t("noMatch"))
						: null,
					matchState.subject.length > 0 || matchState.candidates.length > 0
						? h(
								"div",
								{ className: "dsc-row" },
								h("span", { className: "dsc-chip dsc-chipBrand" }, `${t("subject")}: ${matchState.subject || "—"}`),
								h(
									"span",
									{ className: "dsc-chip" },
									matchState.confident ? t("confident") : t("needConfirm"),
								),
							)
						: null,
					matchState.candidates.length === 0
						? null
						: h(
								"div",
								{ style: { display: "flex", flexDirection: "column", gap: "6px" } },
								matchState.candidates.map((candidate) =>
									h(
										"div",
										{
											key: candidate.id,
											className: target !== null && target.id === candidate.id ? "dsc-cand dsc-candSel" : "dsc-cand",
										},
										h(
											"div",
											{ className: "dsc-candMain" },
											h("span", { className: "dsc-candTitle" }, candidate.title ?? shortId(candidate.id)),
											h(
												"span",
												{ className: "dsc-candMeta" },
												`${candidate.cwd ?? "—"} · ${t("score")} ${candidate.score} · ${fmtTokens(candidate.tokens)} tok · ${fmtAgo(candidate.updatedAt, t)}`,
											),
										),
										h(
											"button",
											{
												type: "button",
												className: "dsc-btn dsc-btnTiny",
												onClick: () => {
													setTarget({ id: candidate.id, title: candidate.title });
													loadDetail(candidate.id);
												},
											},
											t("useThis"),
										),
										h(
											"button",
											{
												type: "button",
												className: "dsc-btn dsc-btnTiny",
												onClick: () => loadDetail(candidate.id),
											},
											t("peek"),
										),
										h(
											"button",
											{
												type: "button",
												className: "dsc-btn dsc-btnTiny",
												onClick: () => openConversation(candidate.id),
											},
											t("openConv"),
										),
									),
								),
							),
					target === null ? h("div", { className: "dsc-hint" }, t("targetNone")) : null,
					target === null
						? null
						: h(
								"div",
								{ className: "dsc-row" },
								h("span", { className: "dsc-hint" }, t("target")),
								h(
									"span",
									{ className: "dsc-chip dsc-chipBrand" },
									h("span", { className: "dsc-chipLabel" }, target.title ?? shortId(target.id)),
									h(
										"button",
										{
											type: "button",
											className: "dsc-chipX",
											title: t("clearTarget"),
											onClick: () => setTarget(null),
										},
										"×",
									),
								),
							),
					h(
						"div",
						{ style: { display: "flex", flexDirection: "column", gap: "6px" } },
						h("span", { className: "dsc-hint" }, t("commandLabel")),
						h("textarea", {
							className: "dsc-textarea",
							value: command,
							placeholder: t("commandPlaceholder"),
							onChange: (event) => setCommand(event.target.value),
						}),
						h(
							"div",
							{ className: "dsc-row" },
							h(
								"div",
								{ className: "dsc-tabs" },
								h(
									"button",
									{
										type: "button",
										className: mode === "queue" ? "dsc-tab dsc-tabOn" : "dsc-tab",
										onClick: () => setMode("queue"),
									},
									t("modeQueue"),
								),
								h(
									"button",
									{
										type: "button",
										className: mode === "steer" ? "dsc-tab dsc-tabOn" : "dsc-tab",
										onClick: () => setMode("steer"),
									},
									t("modeSteer"),
								),
							),
							h("div", { className: "dsc-grow" }),
							target !== null && target.id !== undefined
								? h(
										"button",
										{
											type: "button",
											className: "dsc-btn",
											onClick: () => stopOne(target.id),
										},
										t("stop"),
									)
								: null,
							h(
								"button",
								{
									type: "button",
									className: "dsc-btn dsc-btnPrimary",
									disabled: sendBusy || target === null,
									onClick: () => send(),
								},
								sendBusy ? t("sending") : t("send"),
							),
						),
					),
					notice === null
						? null
						: h("div", { className: notice.kind === "ok" ? "dsc-ok" : "dsc-err" }, notice.text),				),
			);

			/* ---- session list ---- */
			const listCard = h(
				"section",
				{ className: "dsc-card", style: { minHeight: 0 } },
				h(
					"div",
					{ className: "dsc-cardHead" },
					h("h2", { className: "dsc-cardTitle" }, t("listTitle")),
					h("span", { className: "dsc-hint" }, String(visible.length)),
					h("div", { className: "dsc-grow" }),
					h(
						"div",
						{ className: "dsc-tabs" },
						[
							["all", t("filterAll")],
							["running", t("filterRunning")],
							["today", t("filterToday")],
							["cold", t("filterCold")],
							["blank", t("filterBlank")],
						].map(([key, label]) =>
							h(
								"button",
								{
									key,
									type: "button",
									className: filter === key ? "dsc-tab dsc-tabOn" : "dsc-tab",
									onClick: () => setFilter(key),
								},
								label,
							),
						),
					),
					h(
						"div",
						{ className: "dsc-tabs" },
						[
							["heat", t("sortHeat")],
							["tokens", t("sortTokens")],
							["recent", t("sortRecent")],
						].map(([key, label]) =>
							h(
								"button",
								{
									key,
									type: "button",
									className: sort === key ? "dsc-tab dsc-tabOn" : "dsc-tab",
									onClick: () => setSort(key),
								},
								label,
							),
						),
					),
				),
				h(
					"div",
					{ className: "dsc-cardBody", style: { padding: "8px 12px" } },
					h("input", {
						className: "dsc-input",
						type: "search",
						value: needle,
						placeholder: t("searchPlaceholder"),
						onChange: (event) => setNeedle(event.target.value),
					}),
				),
				h(
					"div",
					{ className: "dsc-listHead" },
					h("span", null, t("colSession")),
					h("span", { className: "dsc-num" }, t("colHeat")),
					h("span", { className: "dsc-num" }, t("colTokens")),
					h("span", { style: { textAlign: "right" } }, t("colState")),
				),
				visible.length === 0
					? h("div", { className: "dsc-empty" }, overview.loading === true ? t("loading") : t("empty"))
					: h(
							"div",
							null,
							visible.map((row) => {
								const state = stateOf(row, t);
								const active = target !== null && target.id === row.id;
								return h(
									"div",
									{
										key: row.id,
										className: active
											? row.blank === true
												? "dsc-item dsc-itemActive dsc-itemBlank"
												: "dsc-item dsc-itemActive"
											: row.blank === true
												? "dsc-item dsc-itemBlank"
												: "dsc-item",
										onClick: () => selectRow(row),
										title: `${row.id}\n${row.cwd ?? ""}`,
									},
									h(
										"div",
										{ className: "dsc-itemMain" },
										h("span", {
											className:
												state.key === "run"
													? "dsc-dot dsc-dotRun"
													: state.key === "cold"
														? "dsc-dot dsc-dotCold"
														: state.key === "blank"
															? "dsc-dot dsc-dotBlank"
															: "dsc-dot",
										}),
										h(
											"div",
											{ className: "dsc-itemText" },
											h("span", { className: "dsc-itemTitle" }, row.title ?? shortId(row.id)),
											h(
												"span",
												{ className: "dsc-itemMeta" },
												`${row.leaf ?? "—"} · ${fmtAgo(row.updatedAt, t)}${row.events === undefined ? "" : ` · ${row.events} ${t("eventsUnit")}`}${row.pressureRatio === undefined ? "" : ` · ${t("pressure")} ${row.pressureRatio}%`}${row.model === undefined ? "" : ` · ${modelLabel(row)}`}`,
											),
										),
									),
									HeatCell({ heat: row.heat, max: heatMax }),
									h("span", { className: "dsc-num" }, fmtTokens(row.tokens?.total ?? 0)),
									h(
										"span",
										{ className: state.key === "run" ? "dsc-state dsc-stateRun" : "dsc-state" },
										state.label,
									),
								);
							}),
						),
			);

			/* ---- detail ---- */
			const counts = detail.data?.counts ?? {};
			const detailHeader = detail.data?.header ?? null;
			const detailPath = detailHeader === null ? null : (() => {
				const cwd = typeof detailHeader.cwd === "string" ? detailHeader.cwd : "";
				const leaf = cwd.split(/[\\/]/u).filter((part) => part.length > 0).pop();
				return leaf === undefined ? "—" : leaf;
			})();
			const detailMeta =
				detailHeader === null
					? null
					: [
							detailPath ?? "—",
							typeof detailHeader.agentPreset === "string" ? detailHeader.agentPreset : "—",
							fmtDate(detailHeader.createdAt),
						].join(" · ");
			const detailCard = h(
				"section",
				{ className: "dsc-card" },
				h(
					"div",
					{ className: "dsc-cardHead" },
					h("h2", { className: "dsc-cardTitle" }, t("detailTitle")),
					h("div", { className: "dsc-grow" }),
					detail.id === null
						? null
						: h(
								"button",
								{ type: "button", className: "dsc-btn dsc-btnTiny", onClick: () => openConversation(detail.id) },
								t("openConv"),
							),
				),
				detailMeta === null ? null : h("div", { className: "dsc-hint" }, detailMeta),
				detail.id === null
					? h("div", { className: "dsc-empty" }, t("detailEmpty"))
					: h(
							"div",
							{ className: "dsc-cardBody" },
							detail.loading === true
								? h(
										"div",
										{ style: { display: "flex", flexDirection: "column", gap: "6px" } },
										h("div", { className: "dsc-hint" }, t("detailLoading")),
										h("div", { className: "dsc-skel", style: { width: "70%" } }),
										h("div", { className: "dsc-skel", style: { width: "90%" } }),
										h("div", { className: "dsc-skel", style: { width: "55%" } }),
									)
								: null,
							detail.error === null ? null : h("div", { className: "dsc-err" }, detail.error),
							detail.data === null
								? null
								: h(
										"div",
										{ style: { display: "flex", flexDirection: "column", gap: "10px" } },
										h(
											"div",
											{ className: "dsc-stats" },
											h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("turns")), h("div", { className: "dsc-statValue" }, String(counts.turns ?? 0))),
										h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("steps")), h("div", { className: "dsc-statValue" }, String(counts.steps ?? 0))),
											h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("toolCalls")), h("div", { className: "dsc-statValue" }, String(counts.toolCalls ?? 0))),
											h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("toolErrors")), h("div", { className: "dsc-statValue" }, String(counts.toolErrors ?? 0))),
											h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("failures")), h("div", { className: "dsc-statValue" }, String(detail.data.health?.failures ?? 0))),
											h("div", { className: "dsc-stat" }, h("div", { className: "dsc-statLabel" }, t("events")), h("div", { className: "dsc-statValue" }, String(detail.data.eventCount ?? 0))),
										),
										detail.data.health?.lastFailure === undefined || detail.data.health?.lastFailure === null
											? null
											: h(
													"div",
													{ className: "dsc-hint" },
													`${t("lastFailure")}: ${detail.data.health.lastFailure.kind}${detail.data.health.lastFailure.message === undefined ? "" : ` · ${detail.data.health.lastFailure.message}`}`,
												),
										h(
											"div",
											{ className: "dsc-msgs" },
											(detail.data.messages ?? []).length === 0
												? h("div", { className: "dsc-empty" }, t("noMessages"))
												: (detail.data.messages ?? []).map((message) =>
														h(
															"div",
															{
																key: `${message.seq}`,
																className: message.role === "user" ? "dsc-msg dsc-msgUser" : "dsc-msg",
															},
															h(
																"div",
																{ className: "dsc-msgHead" },
																h("span", { className: "dsc-msgRole" }, message.role === "user" ? t("user") : t("assistant")),
																h("span", null, fmtClock(message.time)),
															),
															h("p", { className: "dsc-msgText" }, message.text),
														),
													),
										),
									),
						),
			);

			return h(
				"div",
				{ className: "dsc-panelHost" },
				h(
					"div",
					{ className: "dsc-root" },
					h(
						"header",
						{ className: "dsc-head" },
						h(
							"div",
							{ className: "dsc-headText" },
							h("h1", { className: "dsc-h1" }, t("title")),
							h("p", { className: "dsc-sub" }, t("subtitle")),
						),
						headTools,
					),
					overview.error === null
						? null
						: h(
								"div",
								{ className: "dsc-err" },
								`${t("failed")}: ${overview.error}`,
							),
					kpis,
					h(
						"div",
						{ className: "dsc-cols" },
						h("div", { style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } }, consoleCard, listCard),
						h(
							"div",
							{ style: { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 } },
							detailCard,
							Array.isArray(totals.projects) && totals.projects.length > 0
								? h(
										"section",
										{ className: "dsc-card" },
										h("div", { className: "dsc-cardHead" }, h("h2", { className: "dsc-cardTitle" }, t("projects"))),
										h("div", { className: "dsc-cardBody" }, h(ProjectRollup, { projects: totals.projects, t })),
									)
								: null,
						),
					),
				),
			);
		}

		/* ---------------------------------------------------------------- */
		/* Sidebar icon                                                     */
		/* ---------------------------------------------------------------- */

		function ConsoleIcon(owner) {
			const size = typeof owner?.size === "number" ? owner.size : 16;
			const active = owner?.active === true;
			const strokeWidth = active ? 1.9 : 1.45;
			return h(
				"svg",
				{
					width: size,
					height: size,
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
					style: { display: "block" },
				},
				h("path", { d: "M2.6 11.2a5.4 5.4 0 1 1 10.8 0", opacity: 0.95 }),
				h("path", { d: "M8 8.2 10.7 5.6" }),
				h("circle", { cx: "8", cy: "8.2", r: "1.15", fill: "currentColor", stroke: "none" }),
				h("path", { d: "M2.6 13.5h10.8", opacity: 0.55 }),
			);
		}

		/* ---------------------------------------------------------------- */
		/* Plugin body                                                      */
		/* ---------------------------------------------------------------- */

		const inject = ["slots", "locale"];

		function apply(ctx) {
			let t = (key) => ZH[key] ?? key;
			try {
				ctx.effect(() => {
					const dispose = ctx.locale?.register?.(NS, { zh: ZH, en: EN });
					return typeof dispose === "function" ? dispose : () => {};
				}, "dsh-session-console: dictionaries");
				if (typeof ctx.locale?.bind === "function") {
					const bound = ctx.locale.bind(NS);
					if (typeof bound === "function") t = bound;
				}
			} catch (error) {
				try {
					console.warn("[dsh-session-console] locale registration failed:", error && error.message);
				} catch {}
			}

			try {
				ctx.effect(() => {
					const el = ensureStyle();
					return () => {
						try {
							if (el !== null && el !== undefined) el.remove();
						} catch {}
					};
				}, "dsh-session-console: stylesheet");
			} catch (error) {
				/* styling is cosmetic — never fail the plugin over it */
			}

			const disposers = [];

			try {
				const offPanel = ctx.slots.register(
					{
						name: "main",
						key: PANEL_ID,
						locale: NS,
						inject: () => ({ t, ctx }),
					},
					Dashboard,
				);
				if (typeof offPanel === "function") disposers.push(offPanel);
			} catch (error) {
				try {
					console.error("[dsh-session-console] main panel registration failed:", error && error.message);
				} catch {}
			}

			try {
				const offIcon = ctx.slots.register(
					{
						name: "sidebar.panellist",
						id: PANEL_ID,
						order: 5,
						label: () => t("nav"),
						locale: NS,
					},
					ConsoleIcon,
				);
				if (typeof offIcon === "function") disposers.push(offIcon);
			} catch (error) {
				try {
					console.error("[dsh-session-console] sidebar icon registration failed:", error && error.message);
				} catch {}
			}

			try {
				ctx.effect(
					() => () => {
						for (const dispose of disposers) {
							try {
								dispose();
							} catch {}
						}
						try {
							const layout = ctx.get?.("layout");
							if (layout?.panelInfo?.getSnapshot?.().activePanelId === PANEL_ID) layout.selectPanel(null);
						} catch {}
					},
					"dsh-session-console: slot disposal",
				);
			} catch (error) {
				/* teardown is best effort */
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
