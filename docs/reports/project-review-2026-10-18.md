# DegreeGPS：最新同步、全栈审查与下一步开发计划

审查日期：2026-10-18（America/Los_Angeles）。审查快照：`8a77373`。本轮只同步、验证和新增本报告，没有修复实现、提交、推送或部署。所有交互使用合成资料；付费 AI 密钥在测试服务中禁用。

## 一、结论

项目已经从“64 门课、三季度审核候选”发展为“351 门课、按专业要求排到毕业、带引用的真实检索问答”。前后端真实连接，PDF 确认成绩、职业技能/项目展示、修改后重算和账户退出隔离都有实际进展。RAG 已经不是预留接口。

但这次更新改变了学术安全边界：注册限制不再阻挡排课，缺失最低成绩可以被假设，未提供开课规律也被推断为 projected；同时前端仍可能显示 **Validated**。还存在把在修课程的全部 OR 先修替代项推断为已完成，以及重复使用同一课程满足不同要求槽位的问题。

**可以演示真实运行的规划/问答原型，但不能把当前结果称为已验证课表、注册许可或可靠的双专业毕业审计。优先修复学术判断与展示语义，再扩充功能或公开上线。**

## 二、安全同步过程及队友改动

- 开始时工作区干净，HEAD 为 `3e9ea75`，本地分支 `integration/backend-frontend`。
- 首次 fetch 看到该远端分支领先 7 个提交；紧接着快进 pull 时 GitHub 报分支不存在。
- 实际 `ls-remote` 确认远端该分支已删除，`main` 和 `backend` 同指 `8a77373`。重新 fetch 后，本地与新 main 的差异为 **0 个本地独有提交 / 15 个远端新增提交**。
- 执行 `git merge --ff-only origin/main`，安全快进成功。本地原有提交均保留；没有 reset、强制合并或 force push。
- 本地分支名称仍是 `integration/backend-frontend`，原远端分支已经删除，因此已将跟踪关系修正为 `origin/main`；当前审查 HEAD 与当时 `origin/main` 一致。后续开发应从新 main 建立功能分支，不应误把旧 integration 分支重新发布当作主线。

从 `3e9ea75` 到 `8a77373` 共 **106 个文件发生增改、移动或删除**。主要提交/功能：

| 提交 | 实际变化 |
| --- | --- |
| `9274fd0` | 清空默认示例课程、退出时清理账户计划状态、改善成绩单审核和结果展示 |
| `b816787` / `5f363cb` | 合并详细 Winter 2027 注册规则，按 SLN/term 加载结构化 restrictions |
| `7717c1c` | 报告移动至 `docs/reports/`，旧 handoff 移入 `data/archive/`，归档 legacy |
| `44cb6f0` | 扩充 30 个专业 profile 的要求/课程资料 |
| `308cf2c` / `f9d74ea` | `/api/ask`、引用型检索、Gemini 兼容支持、embedding 索引、进程内 AI 限流 |
| `e5a5df2` | 专业课程 scope、blocked warnings 汇总、根据真实计划回答问题 |
| `9e5173b` | 扩充 Winter 2027 listing/section |
| `3db8922` | **取消 registration eligibility 对排课的阻挡**，改为课程说明文字 |
| `6ef1b13` | 按毕业季度排秋冬春、接入部分 requirement-aware 优先级和缺口判断 |
| `93eea28` / `8a77373` | Ask UI 默认开启 AI；更新文档描述当前行为 |

没有简单把“新增功能”当作“已完整实现”。以下结论来自源码、实际函数和 HTTP/浏览器观察。

## 三、实际执行结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npm run check` | **PASS：151 tests / 0 failed** | 包括 TypeScript、数据验证、mock contract；不代表所有学术决策满足产品目标 |
| `npm run build` | **PASS** | 生产 webpack 构建；plan/transcript/goal/ask/mock 五个 API 路由编译成功 |
| `npm run validate:data:artifacts` | **PASS：5,274 assertions / 0 failed** | JSON/CSV parity、引用/表达式及 XLSX 结构；不是完整工作簿重算或官方政策重核 |
| 现有 `verify:http` 默认启动方式 | **FAIL：脚本未进入 HTTP 检查** | planner 新增 major-scope 的 server-only 依赖，缺少 `--conditions=react-server` |
| 相同 HTTP 脚本补服务器条件后 | **30 PASS / 1 FAIL** | 唯一失败：仍要求 Winter/Spring/Summer，当前返回 Winter/Spring/Autumn；后续 review-only 旧断言也需在安全语义定稿后检查 |
| 现有 registration HTTP 脚本 | **FAIL，第一组即停止** | 仍断言课程数为 0，实际为 6；不能宣称这次 12 项 HTTP 验收全部通过 |
| 现有 browser smoke | **FAIL/timeout** | 等待旧文案 `2 courses added...`，当前包含确认成绩计数；后面还保留固定三季度断言 |
| 临时当前 UI 浏览器审查 | **8/8 调查场景完成** | 包括故意复现不存在课程添加；不是 8 项全无缺陷的功能验收 |
| 定向真实 API probes | 已复现下述风险 | 注册不匹配仍排课、在修推断、未知 offering 假设、Summer 边界 500、未知课程接受、真实 RAG |

当前 UI 浏览器审查覆盖：空修课历史、14 专业/双专业选择、手动增删、文本 PDF 导入/明确确认两门课和成绩、research 计划、8 季度 24 门课程、技能/项目、Ask 的本地真实检索、改成 SWE internship/2 门课并重算、直接 Regenerate、两个合成账户退出隔离、390px 和 360px 手机布局。

该浏览器运行 **0 个 pageerror、0 个 HTTP 4xx/5xx 资源响应**；故意测试 API 500 的独立请求不包含在这个页面结果中。没有测完每个专业/方向/按钮组合，不宣称全覆盖。未执行付费 embedding/LLM 请求或 rebuild index。

证据在本机 `/private/tmp/degreegps-oct18-*`，包括 check/build/http/browser 日志、API JSON 和截图。这些是临时本机证据；本报告保留了交接所需结果。测试脚本自动生成的旧报告和构建改写的 `next-env.d.ts` 将恢复到同步后的原样，避免把历史报告误当本轮结果。

## 四、对照八项产品目标

| 产品目标 | 完成度 | 实际情况 |
| --- | --- | --- |
| 1. Major/double major 与修课输入 | **PARTIAL** | 前端支持 14 个 major、第二专业和已修/在修课程；PDF 确认成绩已接入。不存在课程仍能添加/提交；重复 major 也缺少完整状态约束。不是自由文本识别双专业 |
| 2. 至少一年 quarter-by-quarter 规划 | **PARTIAL** | 已能按毕业季度生成最多 18 个秋冬春季度。实际 CS+AMATH 生成 Winter 2027–Spring 2029 共 8 季度/24 门。缺少 graduation 时默认 3 个常规季度；不排 Summer。长期安排的开课证据有推断问题 |
| 3. 先修/并修/开课/注册/时间冲突 | **FAIL（整体目标）** | helper 的 AND/OR/grade/concurrency 仍存在，实际 planner 加入不安全 inferred history、missing-grade 假设；registration 虽计算却不阻挡。冲突状态固定 not_evaluated，没有 timetable 检查 |
| 4. 调整并重新生成 | **PARTIAL** | 改输入、目标、load 后实际重新请求 API，Regenerate 可用。不能直接在计划卡片增删/替换/锁定课程，也没有拖放后重新约束计算 |
| 5. 毕业要求进度及双专业 overlaps | **PARTIAL** | 新 scope/requirementNeeds 使用选定的两套 profile；有 remaining/covered 警告。没有可靠的学分/distinct-slot/跨专业分配，也没有逐专业进度和 overlap 面板 |
| 6. 职业目标推荐课程/技能/项目/时间线 | **PARTIAL，真实实现** | career_paths + career.ts 生成目标/track 对应行动、技能、项目；现已展示。仍是 curated 模板，不是实际岗位搜索、技能测评或精细 deadline-aware 课程优化 |
| 7. UW 官方依据/引用 | **PARTIAL** | 实际数据 URL/check date、section detail、引用型 Ask 均已接通；但来源存在不等于结论被证实，未知 offering 被标 projected 尤其需修复 |
| 8. 美观直观、可演示网页 | **PARTIAL** | 主流程、时间线、技能/项目、来源和 Ask 可演示；警告分组改善明显。手机模式标签隐藏、Validated 语义错误、长期计划仍有旧三季度文案等缺陷 |

## 五、关键问题：按优先级给出证据和修复验收

S = 局部修改；M = 跨模块实现/回归；L = 规则分配或大量数据验证。成员 1 后端、2 前端、3 设计、4 数据/QA。

| 优先级 | 问题及真实证据 | 建议与完成标准 | 负责人/工作量 |
| --- | --- | --- | --- |
| **P0-1** | 注册未知/不符的课程被称为 eligible。`lib/planner.ts` options 不再过滤 registration，推入课程时 status 不参考 registration；`components/PlanDashboard.tsx:16` 只凭非 tentative + 官方来源显示 Validated。实际 CS 用户选 CSE 351 C（SLN 12932），同一 Winter 2027 响应 decision=ineligible，course=eligible；浏览器出现 3 个 Validated 卡片，而相关注册资格未知 | 恢复严格 validated 集合：明确不符必须 blocked；未知进入独立 review 集合。若保留假设草案，使用独立状态与醒目标签，绝不 eligible/Validated，不能自动作为已满足先修依据。为此反例做 API+UI 回归 | 1+2+3，M |
| **P0-2** | 在修/已修被展开为全部先修替代项已完成。`lib/planner.ts:85–92` 从 completed **和 inProgress** 出发，flatMap 全部 OR branches；得到的 implied 进入 eligibility 和 requirement progress。实际只填在修 MATH 126、无 completed，Winter 就安排 AMATH 351、AMATH 301、MATH 208 | 只有明确确认的 earned history/已批准等价可以作为 completed。OR 路径不可全认定；在修不能提前兑现。先修“无需重排”的启发式与真实资格证据分离；新增纯 in-progress、多替代项、AP/转学路径回归 | 1，M |
| **P0-3** | 未知成绩照样排入课程并解锁后续。`lib/planner.ts` 的 assumesGrade 将 needs_grade_confirmation 加入 options，并在季末加入 previous。实际无 reviewed grades 的基准计划排入 CSE 311 / CSE 331 | 缺最低成绩保持 unknown/needs_grade_confirmation；可展示待确认方案，但不能混进 validated 或无条件解锁依赖。低分、缺分、未用替代项和假设链分别测试 | 1+2，M |
| **P0-4** | 没写 catalog offering pattern 被当作 regular quarter projected。`lib/offerings.ts:41–43` 明确写 assumed available。351 条记录中 156 条 pattern 为空。基准计划 7 门安排使用这种假设（如 2027 Autumn CSE 312/332/331） | 空白保持 unknown；有明确 catalog recurrence 的也与 exact-term confirmed/department-projected 区分。未知候选可列为 review，但不得借 catalog URL包装成正面开课证据 | 1+4，M |
| **P0-5（毕业审计宣称前）** | requirement 计算忽略 allocation_group/distinct 槽位。`lib/requirements-progress.ts:24` 对每条 choose_courses 独立计数。真实 CS pools 中只给 CSE 401/402/403/421 四门，CS_CORE_400、CS_CORE_EXTRA、CS_CORE_OR_CAPSTONE 三条均被判无需补课，实际数据要求 4+2+1 distinct slots | 实现同一 allocation group 的不重复分配；双专业各自匹配与允许的跨专业共享必须分开。未验证重叠规则时给 review，不要宣称所有专业要求 covered | 1+4，L；当前演示先限制宣称 |
| **P1-1** | 课程不存在也能加入。`components/CourseInput.tsx:14–26` 仅字符串处理；PlanRequest 仅 ID 形状。浏览器成功添加 ZZZZ999；API completed=[ZZZZ 999] 返回 200，无不存在课程提示 | 对 loaded catalog + known external prerequisite IDs 验证/搜索；未知历史允许单独 review 但不悄悄接受。不要简单拒绝所有不在 selected catalog 的真实 external/transfer 记录 | 1+2，M |
| **P1-2** | 默认验证命令/旧 E2E 不一致：verify:http 缺 server condition；补后仍 30/31。registration HTTP 期待零课程提前失败；browser smoke 等旧文案、固定 3 季度 | 先决定 P0 安全契约，再更新测试与脚本。保留能检出 unsafe scheduling 的断言；不能仅把失败期望改成任意课程数。把生产 HTTP 和 browser smoke 纳入 CI | 1+2，M |
| **P1-3** | Summer-only graduation 边界 API 500：start_term=graduation_term=2027-summer，planningTerms 跳过 Summer 得到空数组，而 response 至少一季 | 输入时明确拒绝不支持的 Summer horizon（400/说明）或产生明确支持的非空范围；不得内部 500。同步 API/UI 契约 | 1，S |
| **P1-4** | 缺少真正逐专业 progress/overlap 分配。`requirements-progress.ts:18–31` 把 GPA/manual/unsupported 逻辑当零缺口；credits 缺失默认 4（planner:95）；inProgress/implied 也进入 covered | 用 satisfied / pending / unknown / unmet 区分完成与计划。提供按 profile 的进度、已修与预计分开、共享学分待核实。不能把 manual 当真实满足 | 1+2+4，L；MVP先明确范围 |
| **P1-5** | Catalog 不匹配 profile 时退回所有课程；专业 option/BS/BA/catalog year 自动选默认。`major-scope.ts` 和 `plan-service.ts` 会带警告，但可能仍给不适用课程 | 让用户确认 profile/year/option。未知 major 进入澄清而非跨全校课程优化；双专业要说明受支持组合范围 | 1+2+4，M |
| **P1-6** | 长期计划摘要仍固定“across three quarters”（`lib/ai.ts:71`），左侧仍写 three-quarter；实际 8/14 季度。UI category 仍统一 other，milestone action_items=[] | 用真实 horizon 文案；保留可用 category/action 数据；避免展示空进度能力 | 2+1，S |
| **P1-7** | 手机模式 badge 仍 display:none（`app/globals.css:11`）；390px 实测隐藏。来源统计为大量引用条目，不是独立官方文档（手机示例 989） | 手机也显示 generated/demo/review 状态；来源按课程/quarter 去重折叠，统计明确“引用条目”或去重文档数 | 2+3，S–M |
| **P1-8** | Career 模板按 now→deadline 等分，相关课只来自前 3 季度（`lib/career.ts:20`）；可能引用 deadline 之后的 Autumn 课。hours/preferences 不改变算法；goal interpretation 没接 onboarding | 以目标日期划分 deadline 前准备 vs 长期课程；显式说明哪些是个人建议，不是公司真实截止。要么使用 hours/notes，要么隐藏/标注其尚未生效。不把 Ask 当作 goal parser | 1+2，M |
| **P1-9** | 有真实 RAG，但任何极小 keyword 匹配都可能 insufficient_evidence=false。诊断“zzxyunobtainium polar penguin regulation”返回 M E 414 的 FDA regulation 记录 | 设置相关性/证据不足策略并展示“最近相关记录”；验证回答是否真正回应问题。索引/引用有效不等于语义充分 | 1+4，M |
| **P1-10** | 新长计划与 Ask 的容量边界不一致：AskRequest.plan_course_ids 最大 30，计划允许 18×5；当前测试长计划 27 门 Ask 200，没有复现 >30 的具体计划 | 针对 >30 个课程 ID 做契约测试，支持合理上限或服务端由 plan 重算；这是源码确定的边界风险，不应声称当前每个长计划都会失败 | 1+2，S |
| **P1-11（公开上线前）** | 无真实认证/DB，localStorage demo 仍未隔离于同浏览器操作者。AI UI 默认 true；限流仅单进程内存，X-Forwarded-For 信任代理，不能保证多实例统一额度 | 演示只用合成资料、默认 no-key 可运行。公开接真实用户前做认证、最小权限、持久化与共享限流/预算控制。用户点击的 disclosure、默认 AI 开关需要明确产品选择 | 1+2，M–L |
| **P2** | 拖放/锁定课表、完整 section conflict engine、扩到更多专业、真实岗位搜索、File Search | 当前不阻挡限定范围演示；先完成正确性和清晰范围，避免扩展替代修复 | 全员，后续 |

## 六、数据与 RAG 的真实现状

- `loadData` 实际加载 **351 courses / 1,240 sections**；course enrollment_status 仍全部 unknown。原先 64 门是旧覆盖子集，不应继续把“64”当当前总数。
- 其中 **90 sections** 标 detailed_SLN_notes，**1,150** 为 department_schedule_only。90 是证据审阅数量，不是 90 条完整 eligible 结果。
- Winter 2027 原始 listing：230 listed，121 not_listed。未知/未指定长期 offering 不能靠新增课程数消失。
- 专业资料有 **30 profiles / 14 个 UI 专业家族 / 622 requirement rules / 119 policy issues**。其中顶层 manual_review 123 条、min_gpa 38 条，不能当已完成学位审计。
- Corpus 实际有 **1,380 chunks**。仓库 Gemini embedding index 有 **1,380 条 768 维向量**，逐条 content hash 与当前 corpus 全部匹配，非空占位或过期索引。
- `retrieveSources` 实现本地关键词排名、可选 query embedding、向量融合、来源过滤、plan-aware chunks；`/api/ask` 真实连到前端。
- 本轮真实 API/浏览器只验证 **keyword/extractive fallback**，未付费验证 Gemini/OpenAI 的实时向量/生成质量。单元测试有 provider stub/失败分支，不能冒充真实付费调用。
- 课程问题能引用 `course:CSE 311`；注册时间能引用 `registration_policy:registration_periods`；浏览器“下一季度修什么”引用 `plan:quarter:2027-winter`。不是硬编码 mock 回答。
- Ask 回答从服务端重算的计划生成上下文，避免信任客户端传入任意课程安排；但底层 planner 的错误也可能进入“你的计划”引用。引用不能修正底层决策。

## 七、前端和设计审查

设计参考 `https://claude.ai/artifact/Sv8B8HT5L1Yj5jfhA5N4Ex` 实际尝试访问，工具返回 inaccessible；**无法核实与该 Artifact 的视觉一致性**，不推测其布局/配色。以下只评价当前真实界面与截图。

已可用：五步输入、主/第二专业、目标/track/deadline、毕业年季、修课增删、PDF code/status 编辑与成绩确认、生成/重算、loading/error 代码路径、技能项目区、引用链接、Ask、demo save/open/logout。课程计划本身没有直接增删/替换/拖动编辑器；修改通过返回输入后重新生成。

真实桌面 1440×900：timeline 从约 1,040px 开始，整页约 7,207px，较旧版警告把路线埋在约 5,488px 明显改善。390px 手机 timeline 从约 1,539px 开始；390/360px 均无横向溢出。模式标签仍隐藏，小号 warning/source 字体和过多 source 条目仍影响首屏理解。

Skills/projects/summary 已不再被 adapter 丢弃；旧审计的这项缺口已修复。空白 PDF 警告代码现已渲染，但页面写“OCR can be wrong”，实际仍是 text extraction、无 OCR，文案应改。账户退出实际清理 plan/request，合成 A 退出后登录 B 没有复制旧计划；真正认证仍未实现。`/api/goal` 仍未被本次 onboarding/browser 请求调用。

并非所有按钮失效：生成、改目标、改 load、Regenerate、Ask、确认成绩、账户退出均已实际使用。进度页的 completed actions 没有真正更新工作流，不能宣传为可追踪任务系统。

## 八、下一步开发计划（先后顺序与验收）

### 第一批：恢复可信的学术输出

1. **成员 1** 定义严格 validated / conditional draft / review / blocked 状态边界；明确不符的 section 不进入推荐。**成员 2/3** 同步 badge、卡片和移动端，不能把官方 URL 当 eligibility。
2. **成员 1** 移除把 inProgress 和全部 OR alternatives 写入 completed 的逻辑；保留用户确认的成绩语义。未知最低成绩不得当已满足来解锁依赖。
3. **成员 1+4** 把无 pattern 的 offering 保持 unknown；有 catalog recurrence 与有 exact-term projection 使用不同证据范围。为长期计划保留空缺/审核候选，而不是填满学期。
4. 为本报告反例增加回归：CS→CSE351C、在修 MATH126、OR路径、missing-grade unlock、blank catalog pattern。**这些通过后才决定展示可用演示课表。**

### 第二批：把已有数据变成正确的双专业 MVP

5. **成员 1+4** 先覆盖 CS+AMATH：按 distinct allocation group 分配课程；已修、在修、预计完成、未知审批分开；不做未经批准的跨专业学分共享。
6. **成员 2** 做逐专业剩余要求/课程用途面板，只显示支持的规则；重叠课程标注“可能同时相关，学分共享待确认”。要直接调整计划时，先实现增删/锁定的结构化输入再重算，不使用 DOM-only 假交互。
7. **成员 1+2** 处理 Summer horizon 400/空数组、真实 horizon 文案、课程 existence/review、profile/year 选择，以及 Ask ID 数量边界。

### 第三批：演示整合与上线准备

8. **成员 1+2** 修复已有 HTTP/browser 脚本的运行环境和过期断言；把真实 HTTP 和浏览器关键路径加入 CI。先统一学术契约，不能为了绿灯单纯删除安全检查。
9. **成员 3** 验收桌面/手机状态一致、警告摘要、来源折叠、Ask/技能项目的位置和字体。设计 Artifact 可用后再做准确对照。
10. **成员 4+1** 为 2–3 条合成演示路线维护来源和剩余未知项；用 no-key 模式和 stub 测 AI fallback。实时付费 AI、公开部署和真实学生数据应在明确授权/配置后单独验证。
11. 公开用户账户需求确定后再接数据库/认证。部署预览必须实测 PDF 依赖、数据打包、环境变量、AI 开关和共享限流；本轮未部署。

## 九、推荐演示范围与交接答案

推荐先展示 **CS+AMATH + ML internship 的证据驱动规划助手**：明确合成成绩单→人工确认→两个专业与目标→有来源的长期 tentative/review 规划→技能/项目/建议时间线→修改目标重算→带来源和不确定性的 Ask。不宣称毕业保证、任意双专业优化、可直接注册、无时间冲突或已找到真实岗位。

- **队友增加了什么？** 真数据覆盖、详细 section rules、专业要求引导、长期 horizon、真实 RAG/embedding index、Ask UI 和更完整职业展示。
- **算法是真实的吗？** 是，调用真实 loader/规划/职业/检索，不是默认 mock；但算法目前有本报告的学术正确性缺陷。
- **双专业做到什么程度？** 两套 profile 已进入筛选和需求优先级，比旧版有进展；可靠的毕业进度、distinct allocation、获准共享学分和 overlap UI 仍未完成。
- **64 门资格缺口解决了吗？** 注册资料更细、覆盖扩大，但完整资格并未变为 verified。现在 351 门课程 canonical enrollment 均 unknown，planner 改为忽略这个 gate，不能算问题被解决。
- **Career/RAG 真实吗？** Career 是真实 curated 逻辑且现已展示；RAG 有真实 corpus/index/检索/引用和 API。没有付费验证 live LLM 质量，也不是岗位搜索。
- **下一步最该做什么？** 先修复 registration/Validated、inferred completion、missing grade、无证 offering 这四类风险，再做正确的双专业 allocation 和可靠 E2E。
- **能否上线/参赛？** 可作为受限范围原型演示；目前不适合按“已验证学术/毕业安排”对外承诺。公开上线和付费 AI 仍需独立 release 验证。

本报告不改写历史结论：旧 `registration-integration-report.md` 等描述的是旧提交。请以后以对应 commit 和本轮实际执行记录判断，不沿用旧的 116/31/12 全通过数字。

## 附：同步文件清单

Git name-status 统计：A=26, D=2, M=62, R=16；R 表示移动/重命名，并不表示资料丢失。

<details>
<summary>展开全部新增、修改、移动与删除文件</summary>

```text
M	.env.example
A	AGENTS.md
M	README.md
A	app/api/ask/route.ts
M	app/api/goal/route.ts
M	app/api/plan/route.ts
M	app/globals.css
M	app/page.tsx
A	components/AskPanel.tsx
M	components/PlanDashboard.tsx
M	components/PlanForm.tsx
M	components/TranscriptUpload.tsx
M	data/README.md
R100	docs/REGISTRATION_HANDOFF.md	data/archive/2026-10-17_registration-handoff-v1/REGISTRATION_HANDOFF.md
A	data/archive/2026-10-17_registration-handoff-v1/WINTER_2027_REGISTRATION_REVIEW.md
R099	data/handoff/registration_evidence_handoff.json	data/archive/2026-10-17_registration-handoff-v1/registration_evidence_handoff.json
A	data/archive/2026-10-17_registration-handoff-v1/winter_2027_registration_review.json
A	data/archive/README.md
A	data/index/embeddings.json
M	data/major_requirements/MAJOR_REQUIREMENTS_README.md
M	data/major_requirements/major_requirements.json
M	data/major_requirements/policy_issues.json
M	data/major_requirements/policy_sources.csv
A	data/major_requirements/program_catalog.csv
A	data/major_requirements/program_catalog.json
M	data/major_requirements/requirement_course_map.csv
M	data/major_requirements/requirement_groups.csv
M	data/major_requirements/requirements_test_cases.json
M	data/target_courses/README.md
A	data/target_courses/REGISTRATION_MERGE.md
M	data/target_courses/UniFlow_Winter_2027.xlsx
M	data/target_courses/courses.csv
M	data/target_courses/courses.json
M	data/target_courses/external_prerequisites.json
M	data/target_courses/info_winter_inventory.csv
M	data/target_courses/info_winter_inventory.json
M	data/target_courses/metadata.json
M	data/target_courses/prerequisites.csv
M	data/target_courses/prerequisites.json
A	data/target_courses/registration_rules.json
M	data/target_courses/sections.csv
M	data/target_courses/sections.json
M	docs/api-contract.md
D	docs/backend-data-audit.json
M	docs/backend-handoff.md
M	docs/data-format.md
M	docs/frontend-integration.md
R100	docs/github-private.md	docs/legacy/github-private.md
R100	docs/goal-contract-v2-proposal.md	docs/legacy/goal-contract-v2-proposal.md
R100	mocks/legacy/sample-plan-v1.json	docs/legacy/sample-plan-v1.json
R100	examples/legacy/sample-request-v1.json	docs/legacy/sample-request-v1.json
R100	docs/transcript-api-proposal.md	docs/legacy/transcript-api-proposal.md
R096	docs/backend-data-artifacts.json	docs/reports/backend-data-artifacts.json
A	docs/reports/backend-data-audit.json
R100	docs/backend-http-verification.json	docs/reports/backend-http-verification.json
R100	docs/backend-projected-plan.json	docs/reports/backend-projected-plan.json
R100	docs/backend-validation-plan.json	docs/reports/backend-validation-plan.json
R100	docs/backend-validation-report.md	docs/reports/backend-validation-report.md
R100	docs/frontend-browser-validation.json	docs/reports/frontend-browser-validation.json
R100	docs/fullstack-audit.md	docs/reports/fullstack-audit.md
R100	docs/missing-course-data.md	docs/reports/missing-course-data.md
R100	docs/registration-integration-report.md	docs/reports/registration-integration-report.md
M	docs/team-workflow.md
M	lib/ai.ts
A	lib/ask-api.ts
A	lib/ask-service.ts
M	lib/course-import.ts
M	lib/data.ts
A	lib/major-scope.ts
M	lib/offerings.ts
M	lib/plan-api.ts
A	lib/plan-context.ts
M	lib/plan-service.ts
M	lib/planner.ts
A	lib/rag-corpus.ts
A	lib/rate-limit.ts
M	lib/registration.ts
A	lib/requirements-progress.ts
M	lib/retrieval.ts
M	lib/transcript-api.ts
M	next-env.d.ts
M	package.json
M	scripts/backend-scenarios.ts
M	scripts/browser-smoke.cjs
A	scripts/build-index.ts
D	scripts/check-contract.mjs
M	scripts/validate-data-artifacts.py
M	scripts/validate-data.ts
M	scripts/verify-http.ts
M	scripts/verify-registration-http.ts
M	tests/api.test.ts
A	tests/blocked-courses.test.ts
M	tests/frontend-adapters.test.ts
M	tests/imported-data.test.ts
M	tests/offerings.test.ts
A	tests/plan-context.test.ts
M	tests/prerequisites.test.ts
A	tests/rate-limit.test.ts
M	tests/registration.test.ts
A	tests/retrieval-ranking.test.ts
A	tests/retrieval.test.ts
A	types/ask.ts
M	types/course.ts
M	types/plan.ts
M	types/registration.ts
M	types/ui-plan.ts
```

</details>
