class MockClassList {
  add() {}
  remove() {}
  toggle() {}
}

class MockElement {
  constructor() {
    this.textContent = "";
    this.children = [];
    this.classList = new MockClassList();
    this.style = {};
    this.value = "";
  }

  append(...items) {
    this.children.push(...items);
  }

  prepend(...items) {
    this.children.unshift(...items);
  }

  replaceChildren(...items) {
    this.children = items;
  }

  remove() {}
  click() {}
  addEventListener() {}

  set disabled(value) {
    this._disabled = value;
  }

  get lastElementChild() {
    return this.children[this.children.length - 1];
  }
}

const ctx = new Proxy(
  {},
  {
    get: (_, key) => (key === "measureText" ? () => ({ width: 0 }) : () => {}),
  },
);
const canvas = new MockElement();
canvas.getContext = () => ctx;
canvas.getBoundingClientRect = () => ({ width: 1120, height: 720 });
canvas.clientWidth = 1120;
canvas.clientHeight = 720;
canvas.toDataURL = () => "data:image/png;base64,";

const elements = new Map();
globalThis.document = {
  querySelector(selector) {
    if (selector === "#board") return canvas;
    if (!elements.has(selector)) elements.set(selector, new MockElement());
    return elements.get(selector);
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return new MockElement();
  },
  createTextNode(text) {
    return { textContent: text };
  },
};
globalThis.window = globalThis;
globalThis.addEventListener = () => {};
globalThis.requestAnimationFrame = () => 0;
globalThis.performance = globalThis.performance || { now: () => 0 };
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
delete process.env.OPENAI_MODEL;

await import("../src/app.js");
const server = await import("../server/llm-proxy.mjs");

const api = window.__EDUSKETCH_TEST__;
const cases = [
  "画一个平抛运动，设置初速度 5，设置高度 3，显示速度方向，然后开始模拟",
  "撤回上一步",
  "画一个斜面 添加物块 标出重力 支持力 摩擦力",
  "画一个竖直圆轨道 添加小球 设置脱离角度六十度 开始模拟",
];

const parsed = cases.map((text) => ({ text, actions: api.parseCommand(text) }));
const spacedHeightActions = api.parseCommand("画一个平抛运动 设置高度 6");
const chineseHeightActions = api.parseCommand("把高度改成六米");
const combinedProjectileParams = api.parseCommand("画一个平抛运动 设置初速度 5 设置高度 7");
const velocityCompareActions = api.parseCommand("对比初速度 3 6 9");
const loginFlowActions = api.parseCommand("画一个登录流程图");
const frontendBackendActions = api.parseCommand("画一个前后端框架");
const circleActions = api.parseCommand("画一个圆形");
const shoppingFlowActions = api.parseCommand("画一个在线购物流程");
const aiDevFlowActions = api.parseCommand("帮我画一个 AI 应用开发的大致流程");
const loginSystemActions = api.parseCommand("帮我画一下用户登录系统的过程");
const requestFlowActions = api.parseCommand("画一个从用户请求到数据库返回结果的流程");
const clarificationActions = api.parseCommand("帮我画一个系统");
api.handleTranscript(cases[0]);
const stateAfter = api.getState();
api.handleTranscript("对比初速度 3 6 9");
const projectileCompareState = api.getState();
api.handleTranscript("画一个登录流程图");
const diagramBeforeExtend = api.getState();
api.handleTranscript("添加短信验证码节点");
const diagramAfterExtend = api.getState();
api.handleTranscript("画一个登录流程图");
const diagramBeforeComplex = api.getState();
api.handleTranscript("复杂这个流程图");
const diagramAfterComplex = api.getState();
api.handleTranscript("把输入账号密码改成填写账号");
const diagramAfterRename = api.getState();
api.handleTranscript("删除登录失败节点");
const diagramAfterDelete = api.getState();
api.handleTranscript("画一个在线购物流程");
const shoppingByVoice = api.getState();
api.handleTranscript("复杂一点");
const shoppingAfterVagueComplex = api.getState();
api.handleTranscript("确认");
const shoppingAfterConfirmedComplex = api.getState();
api.handleTranscript("生成一个购物流程图");
const shoppingByGenerateVoice = api.getState();
api.handleTranscript("生成一个购物流程图");
const shoppingAfterDuplicateVoice = api.getState();
api.handleTranscript("简化这个图");
const diagramAfterSimplify = api.getState();
api.handleTranscript("停止监听");
const listeningWantedAfterStop = api.isListeningWanted();
const projectileAnalysis = api.localAnalyzeProblem("一小球从离地 3m 高的平台以 5m/s 的初速度水平抛出，不计空气阻力，求小球落地时间和水平位移。");
const circularAnalysis = server.localAnalyzeProblem("小球沿竖直圆轨道运动，在与水平方向成 60 度的位置脱离轨道，分析脱离后的运动轨迹。");
const horizontalAnalysis = api.localAnalyzeProblem("一个质量为 2 kg 的物体在光滑水平面上受到一个大小为 10 N 的水平力，求物体的加速度。");
const qualitativeHorizontalAnalysis = api.localAnalyzeProblem("物块放在水平面上，受到水平向右的拉力，分析物块受到的力。");
const filteredActions = api.validateActions([{ type: "draw_projectile" }, { type: "delete_everything" }, { type: "show_force", force: "bad" }]);
const genericActionAliases = api.validateActions([
  { type: "draw_box", id: "box", text: "节点", x: 100, y: 120 },
  { type: "draw_line", x1: 100, y1: 100, x2: 240, y2: 100 },
  { type: "ask_clarification", message: "你想画哪类系统？" },
]);
const coercedLlmFlow = server.coerceLlmCommandResult(
  {
    reply: "我会生成员工入职流程图。",
    title: "员工入职流程",
    nodes: [
      { label: "提交资料" },
      { label: "主管审批" },
      { label: "签署合同" },
      { label: "开通账号" },
    ],
  },
  "画一个员工入职流程图",
);
const nestedLlmFlow = server.coerceLlmCommandResult(
  {
    reply: "我会生成报销流程图。",
    data: {
      nodes: ["提交报销单", "主管审批", "财务复核", "打款"],
    },
  },
  "画一个报销流程图",
);
const repairedLlmFlow = server.coerceLlmCommandResult(
  {
    reply: "我会生成员工入职流程图。",
    actions: [
      { type: "node", label: "提交资料" },
      { type: "node", label: "主管审批" },
    ],
  },
  "画一个员工入职流程图，包括提交资料主管审批签合同开通账号",
);
const constrainedExtensionFlow = server.coerceLlmCommandResult(
  {
    reply: "我会扩展吃饭流程图。",
    actions: [
      { type: "clear_canvas" },
      { type: "draw_rect", id: "title", text: "吃饭流程图" },
      { type: "draw_rect", id: "prep", text: "准备食材" },
      { type: "draw_rect", id: "cook", text: "烹饪食物" },
      { type: "draw_rect", id: "plate", text: "盛饭装盘" },
      { type: "draw_rect", id: "eat", text: "用餐" },
      { type: "draw_rect", id: "bad1", text: "新步骤" },
      { type: "draw_rect", id: "bad2", text: "一点" },
    ],
  },
  "复杂一点",
  {
    currentDiagram: {
      nodes: [
        { id: "title", text: "吃饭流程图", x: 120, y: 320, width: 150, height: 64 },
        { id: "prep", text: "准备食材", x: 290, y: 320, width: 150, height: 64 },
        { id: "cook", text: "烹饪食物", x: 460, y: 320, width: 150, height: 64 },
        { id: "plate", text: "盛饭装盘", x: 630, y: 320, width: 150, height: 64 },
      ],
      arrows: [],
    },
  },
);
const fittedDiagram = api.fitDiagramElements(
  [
    { type: "draw_rect", id: "a", text: "A", x: 100, y: 320, width: 130, height: 56, color: "#eef3ff" },
    { type: "draw_rect", id: "b", text: "B", x: 900, y: 250, width: 130, height: 56, color: "#dff5ec" },
    { type: "draw_arrow", from: "a", to: "b", text: "" },
  ],
  1000,
  720,
);
const appServer = server.createAppServer();
const apiResults = await new Promise((resolve, reject) => {
  appServer.listen(0, "127.0.0.1", async () => {
    try {
      const { port } = appServer.address();
      const analyzeResponse = await fetch(`http://127.0.0.1:${port}/api/analyze-problem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemText: "一个物块静止在粗糙斜面上，斜面倾角为 30 度，分析物块所受的力。" }),
      });
      const analysis = await analyzeResponse.json();
      const commandResponse = await fetch(`http://127.0.0.1:${port}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "做受力分析", problemContext: analysis }),
      });
      const command = await commandResponse.json();
      const shoppingResponse = await fetch(`http://127.0.0.1:${port}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "画一个在线购物流程", problemContext: null }),
      });
      const shopping = await shoppingResponse.json();
      const noAiResponse = await fetch(`http://127.0.0.1:${port}/api/parse-command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "画一个员工入职流程图，包括提交资料主管审批签合同开通账号", problemContext: null }),
      });
      const noAi = await noAiResponse.json();
      resolve({ analysis, command, shopping, noAi });
    } catch (error) {
      reject(error);
    } finally {
      appServer.close();
    }
  });
});

function pass(message) {
  console.log(`[PASS] ${message}`);
}

function assert(condition, failMessage, passMessage) {
  if (!condition) {
    throw new Error(failMessage);
  }
  pass(passMessage);
}

assert(parsed[0].actions.length >= 5, "复合平抛指令没有拆出足够动作", "parser splits multi-action projectile command");
assert(
  parsed[1].actions.some((action) => action.type === "undo"),
  "撤回指令未识别",
  "parser handles voice undo command",
);
assert(
  parsed[2].actions.some((action) => action.type === "show_force" && action.force === "friction"),
  "斜面受力指令未识别摩擦力",
  "parser handles inclined-plane force command",
);
assert(
  parsed[3].actions.some((action) => action.type === "set_release_angle" && action.value === 60),
  "中文数字脱离角未识别",
  "parser handles Chinese number angle",
);
assert(
  stateAfter.scene === "projectile" && stateAfter.projectile.velocity === 5 && stateAfter.projectile.height === 3,
  "平抛指令执行后的状态不正确",
  "command execution updates projectile state",
);
assert(
  spacedHeightActions.some((action) => action.type === "set_projectile_height" && action.value === 6),
  "空格分隔的高度数值没有识别",
  "parser handles spaced height value",
);
assert(
  chineseHeightActions.some((action) => action.type === "set_projectile_height" && action.value === 6),
  "中文高度数值没有识别",
  "parser handles Chinese height value",
);
assert(
  combinedProjectileParams.some((action) => action.type === "set_projectile_velocity" && action.value === 5) &&
    combinedProjectileParams.some((action) => action.type === "set_projectile_height" && action.value === 7),
  "同一句话里的速度和高度没有分别识别",
  "parser handles combined projectile parameters",
);
assert(
  velocityCompareActions.some((action) => action.type === "compare_projectile_velocity" && action.values.join(",") === "3,6,9"),
  "初速度对比指令没有识别速度列表",
  "parser handles projectile velocity comparison",
);
assert(
  projectileCompareState.scene === "projectile" &&
    projectileCompareState.projectile.compareVelocities.join(",") === "3,6,9" &&
    projectileCompareState.projectile.showTrajectory,
  "初速度对比没有更新平抛状态",
  "velocity comparison updates projectile state",
);
assert(
  loginFlowActions.some((action) => action.type === "draw_rect" && action.text === "输入账号密码") &&
    loginFlowActions.some((action) => action.type === "draw_arrow"),
  "登录流程图没有扩展成结构化绘图动作",
  "voice intent expands into diagram actions",
);
assert(
  frontendBackendActions.some((action) => action.type === "draw_rect" && action.text === "前端页面") &&
    frontendBackendActions.some((action) => action.type === "draw_rect" && action.text === "后端 API") &&
    !frontendBackendActions.some((action) => action.text === "节点"),
  "前后端框架没有命中具体架构模板",
  "frontend/backend framework uses concrete template nodes",
);
assert(
  circleActions.some((action) => action.type === "draw_circle") &&
    !circleActions.some((action) => action.text === "节点"),
  "基础圆形指令没有生成圆形动作",
  "basic shape command draws a circle",
);
assert(
  shoppingFlowActions.filter((action) => action.type === "draw_rect").length >= 4 &&
    shoppingFlowActions.some((action) => action.text === "支付订单"),
  "在线购物流程没有泛化成多节点流程图",
  "generalized shopping flow creates multiple nodes",
);
assert(
  aiDevFlowActions.filter((action) => action.type === "draw_rect").length >= 4 &&
    aiDevFlowActions.some((action) => action.text === "模型调用"),
  "AI 应用开发流程没有生成流程节点",
  "AI development flow creates diagram actions",
);
assert(
  loginSystemActions.some((action) => action.text === "输入账号密码") &&
    loginSystemActions.some((action) => action.type === "draw_arrow"),
  "用户登录系统自然表达没有命中登录流程图",
  "natural login-system phrasing creates login flow",
);
assert(
  requestFlowActions.filter((action) => action.type === "draw_rect").length >= 4 &&
    requestFlowActions.some((action) => action.text === "查询数据库"),
  "请求到数据库返回流程没有泛化成流程图",
  "request/database phrasing creates generalized flow",
);
assert(
  clarificationActions.some((action) => action.type === "ask_clarification"),
  "模糊系统意图没有请求澄清",
  "ambiguous diagram request asks clarification",
);
assert(
  genericActionAliases.some((action) => action.type === "draw_rect" && action.text === "节点") &&
    genericActionAliases.some((action) => action.type === "draw_line") &&
    genericActionAliases.some((action) => action.type === "ask_clarification"),
  "通用图元 action 没有通过校验",
  "generic drawing actions are validated",
);
assert(
  coercedLlmFlow.source === "llm-coerced" &&
    coercedLlmFlow.actions.filter((action) => action.type === "draw_rect").length >= 4 &&
    coercedLlmFlow.actions.some((action) => action.text === "签署合同"),
  "LLM 返回 nodes 但没有 actions 时没有转换成流程图",
  "LLM node response coerces into diagram actions",
);
assert(
  nestedLlmFlow.source === "llm-coerced" &&
    nestedLlmFlow.actions.some((action) => action.text === "财务复核"),
  "LLM 把节点放在 data.nodes 时没有转换成流程图",
  "LLM nested node response coerces into diagram actions",
);
assert(
  repairedLlmFlow.source === "llm-repaired" &&
    repairedLlmFlow.actions.some((action) => action.text === "开通账号") &&
    repairedLlmFlow.actions.some((action) => action.type === "draw_arrow"),
  "LLM 返回非法 action 类型时没有从用户文本修复流程图",
  "invalid LLM actions are repaired from user text",
);
assert(
  constrainedExtensionFlow.actions.some((action) => action.text === "用餐") &&
    constrainedExtensionFlow.actions.some((action) => action.type === "draw_arrow" && action.from === "plate") &&
    !constrainedExtensionFlow.actions.some((action) => action.type === "clear_canvas") &&
    !constrainedExtensionFlow.actions.some((action) => ["吃饭流程图", "准备食材", "烹饪食物", "盛饭装盘", "新步骤", "一点"].includes(action.text)),
  "扩容时没有限制为只追加真实新增节点",
  "diagram expansion is constrained to meaningful new nodes",
);
assert(
  diagramAfterExtend.scene === "diagram" &&
    diagramAfterExtend.diagram.elements.length > diagramBeforeExtend.diagram.elements.length &&
    diagramAfterExtend.diagram.elements.some((element) => element.text === "短信验证码"),
  "当前流程图没有追加新节点",
  "voice command extends current diagram",
);
assert(
  diagramAfterComplex.scene === "diagram" &&
    diagramAfterComplex.diagram.elements.length > diagramBeforeComplex.diagram.elements.length &&
    diagramAfterComplex.diagram.elements.some((element) => element.text === "进入首页") &&
    diagramAfterComplex.diagram.elements.some((element) => element.text === "重试/找回密码"),
  "复杂当前流程图没有追加登录细化节点",
  "voice command enriches current login diagram",
);
assert(
  diagramAfterRename.diagram.elements.some((element) => element.text === "填写账号"),
  "语音重命名节点没有生效",
  "voice command renames a node",
);
assert(
  !diagramAfterDelete.diagram.elements.some((element) => element.text === "登录失败"),
  "语音删除节点没有生效",
  "voice command deletes a node",
);
assert(
  shoppingByVoice.scene === "diagram" &&
    shoppingByVoice.diagram.elements.some((element) => element.text === "支付订单"),
  "购物流程语音没有直接绘图",
  "shopping flow voice command draws immediately",
);
assert(
  !shoppingAfterVagueComplex.diagram.elements.some((element) => ["一点", "新步骤"].includes(element.text)),
  "模糊扩容被本地规则添加成垃圾节点",
  "vague diagram expansion is not handled by local placeholder nodes",
);
assert(
  shoppingAfterVagueComplex.diagram.elements.length === shoppingByVoice.diagram.elements.length &&
    shoppingAfterConfirmedComplex.diagram.elements.length > shoppingAfterVagueComplex.diagram.elements.length &&
    shoppingAfterConfirmedComplex.diagram.elements.some((element) => element.text === "物流跟踪"),
  "模糊扩容没有先确认再追加语义节点",
  "vague diagram expansion requires confirmation before semantic additions",
);
assert(
  shoppingByGenerateVoice.scene === "diagram" &&
    shoppingByGenerateVoice.diagram.elements.some((element) => element.text === "支付订单"),
  "“生成一个购物流程图”没有直接绘图",
  "generate shopping flow phrasing draws immediately",
);
assert(
  JSON.stringify(shoppingAfterDuplicateVoice.diagram.elements) === JSON.stringify(shoppingByGenerateVoice.diagram.elements),
  "重复语音 final 结果被重复执行",
  "duplicate speech result is ignored briefly",
);
assert(
  diagramAfterSimplify.diagram.elements.filter((element) => element.type === "draw_rect" || element.type === "draw_circle").length <= 4,
  "语音简化图示没有减少节点",
  "voice command simplifies diagram",
);
assert(!listeningWantedAfterStop, "停止监听语音指令没有关闭监听意图", "voice command stops microphone listening");
assert(
  fittedDiagram
    .filter((element) => element.type === "draw_rect")
    .every((element) => element.x >= 0 && element.x + element.width <= 1000),
  "流程图布局适配后仍然超出画布",
  "diagram layout fits canvas width",
);
assert(typeof window.EDUSKETCH_LLM_PARSE === "undefined", "LLM 兜底接口不应默认启用", "LLM fallback interface is optional");
assert(
  projectileAnalysis.sceneType === "projectile" &&
    projectileAnalysis.knowns.some((item) => item.symbol === "v0" && item.value === 5),
  "题目分析未正确抽取平抛初速度",
  "problem analysis extracts projectile knowns",
);
assert(
  circularAnalysis.sceneType === "circular_release" &&
    circularAnalysis.actions.some((action) => action.type === "set_release_angle" && action.value === 60),
  "服务端本地分析未正确识别圆周脱离角度",
  "server fallback analyzes circular release problem",
);
assert(
  horizontalAnalysis.sceneType === "horizontal_force" &&
    horizontalAnalysis.knowns.some((item) => item.symbol === "m" && item.value === 2) &&
    horizontalAnalysis.knowns.some((item) => item.symbol === "F" && item.value === 10) &&
    horizontalAnalysis.actions.some((action) => action.type === "draw_horizontal_surface"),
  "本地分析未正确识别光滑水平面受力题",
  "problem analysis handles horizontal force problem",
);
assert(
  qualitativeHorizontalAnalysis.sceneType === "horizontal_force" &&
    qualitativeHorizontalAnalysis.knowns.length === 0 &&
    qualitativeHorizontalAnalysis.actions.some((action) => action.type === "draw_horizontal_surface") &&
    !qualitativeHorizontalAnalysis.actions.some((action) => action.type === "show_applied_force") &&
    !qualitativeHorizontalAnalysis.actions.some((action) => action.type === "show_acceleration"),
  "无数值水平拉力题没有保持基础示意图阶段",
  "problem analysis keeps qualitative horizontal diagram staged",
);
assert(filteredActions.length === 1 && filteredActions[0].type === "draw_projectile", "非法动作未被过滤", "action whitelist filters unsafe actions");
assert(
  apiResults.analysis.sceneType === "inclined_plane" &&
    apiResults.analysis.actions.some((action) => action.type === "draw_inclined_plane") &&
    !apiResults.analysis.actions.some((action) => action.type === "show_force"),
  "分析题目 API 不应直接返回力箭头动作",
  "analyze-problem API returns staged base actions",
);
assert(
  apiResults.command.actions.some((action) => action.type === "show_force" && action.force === "normal"),
  "上下文指令没有返回受力分析动作",
  "parse-command API returns force-analysis actions",
);
assert(
  apiResults.shopping.actions.filter((action) => action.type === "draw_rect").length >= 4 &&
    apiResults.shopping.actions.some((action) => action.text === "支付订单"),
  "parse-command API 未泛化在线购物流程",
  "parse-command API generalizes shopping flow",
);
assert(
  apiResults.noAi.source === "ai-disabled" &&
    apiResults.noAi.actions.length === 0 &&
    apiResults.noAi.llmError === "OPENAI_API_KEY is not configured",
  "未配置 API Key 时不应伪装成 context 兜底",
  "API reports disabled AI for non-template diagram requests",
);

console.log("[PASS] smoke test completed");
