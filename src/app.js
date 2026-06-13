const canvas = document.querySelector("#board");
const ctx = canvas.getContext("2d");

const ui = {
  micButton: document.querySelector("#micButton"),
  micLabel: document.querySelector("#micLabel"),
  status: document.querySelector("#status"),
  transcript: document.querySelector("#transcript"),
  actions: document.querySelector("#actions"),
  log: document.querySelector("#log"),
  paramScene: document.querySelector("#paramScene"),
  paramVelocity: document.querySelector("#paramVelocity"),
  paramHeight: document.querySelector("#paramHeight"),
  paramAngle: document.querySelector("#paramAngle"),
  paramMass: document.querySelector("#paramMass"),
  paramForce: document.querySelector("#paramForce"),
  parseCount: document.querySelector("#parseCount"),
  aiCalls: document.querySelector("#aiCalls"),
  problemText: document.querySelector("#problemText"),
  analyzeProblemButton: document.querySelector("#analyzeProblemButton"),
  drawProblemButton: document.querySelector("#drawProblemButton"),
  analysisStatus: document.querySelector("#analysisStatus"),
  analysisScene: document.querySelector("#analysisScene"),
  analysisSource: document.querySelector("#analysisSource"),
  knowledgeList: document.querySelector("#knowledgeList"),
  knownsList: document.querySelector("#knownsList"),
  goalsList: document.querySelector("#goalsList"),
  stepsList: document.querySelector("#stepsList"),
  visualPlan: document.querySelector("#visualPlan"),
  limitationsList: document.querySelector("#limitationsList"),
  aiRawText: document.querySelector("#aiRawText"),
  aiSummary: document.querySelector("#aiSummary"),
  aiSource: document.querySelector("#aiSource"),
  aiActionCount: document.querySelector("#aiActionCount"),
};

const sceneNames = {
  empty: "空画布",
  projectile: "平抛运动",
  circular: "圆周脱离",
  inclined: "斜面受力",
  horizontal: "水平面受力",
  diagram: "智能图示",
};

const actionLabels = {
  draw_projectile: "绘制平抛运动",
  set_projectile_velocity: "设置初速度",
  set_projectile_height: "设置高度",
  draw_circular_track: "绘制竖直圆轨道",
  add_ball: "添加小球",
  set_release_angle: "设置脱离角度",
  draw_inclined_plane: "绘制斜面",
  draw_horizontal_surface: "绘制水平面",
  add_block: "添加物块",
  set_mass: "设置质量",
  set_force: "设置外力",
  show_force: "标出力",
  show_applied_force: "显示外力",
  show_acceleration: "显示加速度",
  show_trajectory: "显示轨迹",
  show_velocity: "显示速度方向",
  show_gravity: "显示重力方向",
  compare_projectile_velocity: "对比初速度",
  start_simulation: "开始模拟",
  pause_simulation: "暂停模拟",
  replay_simulation: "重播模拟",
  clear_canvas: "清空画布",
  undo: "撤回上一步",
  export_image: "导出图片",
  llm_fallback: "复杂指令兜底",
  ask_clarification: "请求澄清",
  draw_box: "绘制矩形节点",
  draw_rect: "绘制矩形节点",
  draw_circle: "绘制圆形节点",
  draw_arrow: "绘制箭头",
  draw_line: "绘制线条",
  draw_text: "绘制文字",
  draw_template: "调用模板",
  rename_node: "重命名节点",
  delete_node: "删除节点",
};

const sceneTypeNames = {
  projectile: "平抛运动",
  circular_release: "圆周运动脱离",
  inclined_plane: "斜面受力分析",
  horizontal_force: "水平面受力分析",
  diagram_plan: "图示规划",
  unknown: "暂不支持",
};

const allowedActionTypes = new Set([
  "draw_projectile",
  "set_projectile_velocity",
  "set_projectile_height",
  "draw_circular_track",
  "add_ball",
  "set_release_angle",
  "draw_inclined_plane",
  "draw_horizontal_surface",
  "add_block",
  "set_mass",
  "set_force",
  "show_force",
  "show_applied_force",
  "show_acceleration",
  "show_trajectory",
  "show_velocity",
  "show_gravity",
  "compare_projectile_velocity",
  "start_simulation",
  "pause_simulation",
  "replay_simulation",
  "clear_canvas",
  "undo",
  "export_image",
  "ask_clarification",
  "draw_box",
  "draw_rect",
  "draw_circle",
  "draw_arrow",
  "draw_line",
  "draw_text",
  "draw_template",
  "rename_node",
  "delete_node",
]);

const allowedForces = new Set(["gravity", "normal", "friction"]);

const defaultState = {
  scene: "empty",
  projectile: {
    velocity: 5,
    height: 3,
    showVelocity: false,
    showGravity: false,
    showTrajectory: false,
    compareVelocities: [],
    ball: true,
  },
  circular: {
    releaseAngle: 60,
    ball: false,
    showVelocity: false,
    showGravity: false,
    showTrail: false,
  },
  inclined: {
    block: false,
    forces: {
      gravity: false,
      normal: false,
      friction: false,
    },
  },
  horizontal: {
    block: false,
    mass: null,
    force: null,
    showGravity: false,
    showNormal: false,
    showAppliedForce: false,
    showAcceleration: false,
  },
  diagram: {
    title: "",
    elements: [],
  },
  animation: {
    running: false,
    mode: null,
    startMs: 0,
    elapsed: 0,
  },
  lastTranscript: "",
  lastActions: [],
};

let state = structuredClone(defaultState);
let historyStack = [];
let recognition = null;
let listening = false;
let wantsListening = false;
let lastHandledSpeech = { text: "", time: 0 };
let rafId = 0;
let stats = {
  localParseCount: 0,
  aiCalls: 0,
};
let problemAnalysis = null;
let currentStepIndex = 0;
let pendingVoiceAction = null;

function cloneState(value) {
  return structuredClone(value);
}

function remember() {
  const snapshot = cloneState(state);
  snapshot.animation.running = false;
  snapshot.animation.startMs = 0;
  historyStack.push(snapshot);
  if (historyStack.length > 40) {
    historyStack.shift();
  }
}

function restorePrevious() {
  if (historyStack.length === 0) {
    addLog("没有可以撤回的步骤");
    speak("没有可以撤回的步骤");
    return;
  }
  state = historyStack.pop();
  state.lastActions = [{ type: "undo" }];
  addLog("已撤回上一步");
  speak("已撤回上一步");
  render();
}

function normalizeText(text) {
  return text
    .replace(/[，。！？、；：,.!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chineseNumberToDigit(text) {
  const map = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    const tenValue = tens ? map[tens] ?? 1 : 1;
    const oneValue = ones ? map[ones] ?? 0 : 0;
    return tenValue * 10 + oneValue;
  }
  return map[text];
}

function extractNumber(text, fallback) {
  const numeric = text.match(/-?\d+(\.\d+)?/);
  if (numeric) return Number(numeric[0]);
  const chinese = text.match(/[零一二两三四五六七八九十]+/);
  if (chinese) return chineseNumberToDigit(chinese[0]);
  return fallback;
}

function hasNumber(text) {
  return /-?\d+(\.\d+)?|[零一二两三四五六七八九十]+/.test(text);
}

function extractNumberAfterKeywords(text, keywords, fallback) {
  const normalized = normalizeText(text);
  for (const keyword of keywords) {
    const index = normalized.indexOf(keyword);
    if (index < 0) continue;
    const tail = normalized.slice(index + keyword.length, index + keyword.length + 18);
    if (hasNumber(tail)) return extractNumber(tail, fallback);
  }
  return hasNumber(normalized) ? extractNumber(normalized, fallback) : fallback;
}

function extractNumbers(text) {
  const values = [];
  for (const match of String(text || "").matchAll(/-?\d+(\.\d+)?|[零一二两三四五六七八九十]+/g)) {
    const value = extractNumber(match[0], NaN);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

function isDiagramExtensionText(text) {
  return includesAny(text, ["扩展", "扩容", "追加", "添加", "增加", "补充", "继续", "再加", "加一个", "复杂", "复杂化", "细化", "完善", "丰富", "展开"]);
}

function stripDiagramExtensionText(text) {
  return normalizeText(text)
    .replace(/^(请|帮我|给我|然后|再|继续|顺便)\s*/g, "")
    .replace(/(扩展|扩容|追加|添加|增加|补充|继续|再加|加一个|加上|新增|复杂化|复杂|细化|完善|丰富|展开)/g, "")
    .replace(/(当前|现在|这个|这张|流程图|图示|节点|步骤|一个|一项|一条|一点|一下|一些|分支|环节|到流程里|到图里|进去)/g, "")
    .trim();
}

function isMeaningfulExtensionText(text) {
  const cleaned = normalizeText(text);
  if (!cleaned || cleaned.length < 2) return false;
  if (includesAny(cleaned, ["一点", "一下", "一些", "新步骤", "新节点", "更复杂", "更丰富"])) return false;
  return true;
}

function getDiagramNodes(elements = state.diagram.elements) {
  return elements.filter((element) => element.type === "draw_rect" || element.type === "draw_circle");
}

function getNodeBox(element) {
  if (element.type === "draw_circle") {
    return {
      x: element.x - element.radius,
      y: element.y - element.radius,
      width: element.radius * 2,
      height: element.radius * 2,
    };
  }
  return {
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
  };
}

function buildLoginComplexityActions(nodes) {
  const success = nodes.find((node) => node.id === "success" || node.text === "登录成功");
  const fail = nodes.find((node) => node.id === "fail" || node.text === "登录失败");
  if (!success || !fail) return [];

  const successBox = getNodeBox(success);
  const failBox = getNodeBox(fail);
  const homeId = "home";
  const retryId = "retry";
  const hasHome = nodes.some((node) => node.id === homeId || node.text === "进入首页");
  const hasRetry = nodes.some((node) => node.id === retryId || node.text === "重试/找回密码");
  const actions = [];

  if (!hasHome) {
    actions.push(
      { type: "draw_rect", id: homeId, text: "进入首页", x: successBox.x + successBox.width + 74, y: successBox.y, width: 150, height: 64, color: "#dff5ec" },
      { type: "draw_arrow", from: success.id, to: homeId, text: "" },
    );
  }
  if (!hasRetry) {
    actions.push(
      { type: "draw_rect", id: retryId, text: "重试/找回密码", x: failBox.x + failBox.width + 74, y: failBox.y, width: 160, height: 64, color: "#ffe2e2" },
      { type: "draw_arrow", from: fail.id, to: retryId, text: "" },
    );
  }

  return actions;
}

function hasDiagramNodeText(nodes, text) {
  const normalized = normalizeText(text);
  return nodes.some((node) => normalizeText(node.text).includes(normalized) || normalized.includes(normalizeText(node.text)));
}

function classifyCurrentDiagram(nodes) {
  const text = nodes.map((node) => node.text).join(" ");
  if (includesAny(text, ["吃饭", "食材", "烹饪", "盛饭", "用餐"])) return "meal";
  if (includesAny(text, ["购物", "商品", "购物车", "支付", "发货", "收货"])) return "shopping";
  if (includesAny(text, ["入职", "资料", "合同", "账号", "主管"])) return "onboarding";
  if (includesAny(text, ["登录", "账号", "密码", "校验"])) return "login";
  if (includesAny(text, ["前端", "后端", "数据库", "API", "服务"])) return "architecture";
  return "generic";
}

function semanticExpansionCandidates(nodes) {
  const presets = {
    meal: ["清洗食材", "调味", "收拾餐具"],
    shopping: ["库存校验", "物流跟踪", "售后评价"],
    onboarding: ["入职培训", "设备领取", "试用期跟进"],
    login: ["短信验证码", "进入首页", "重试/找回密码"],
    architecture: ["鉴权网关", "缓存服务", "日志监控"],
    generic: [],
  };
  const type = classifyCurrentDiagram(nodes);
  return (presets[type] || []).filter((text) => !hasDiagramNodeText(nodes, text)).slice(0, 3);
}

function buildConfirmedExtensionActions(nodes, labels) {
  if (!nodes.length || !labels.length) return [];
  const lastNode = nodes
    .map((node) => ({ node, box: getNodeBox(node) }))
    .sort((a, b) => a.box.x + a.box.width - (b.box.x + b.box.width))
    .at(-1);
  let previousId = lastNode.node.id;
  return labels.flatMap((label, index) => {
    const id = `confirm_extend_${Date.now()}_${index}`;
    const action = {
      type: "draw_rect",
      id,
      text: label,
      x: lastNode.box.x + lastNode.box.width + 74 + index * 170,
      y: lastNode.box.y,
      width: 150,
      height: 64,
      color: index % 2 === 0 ? "#e7f6ef" : "#fff0ce",
    };
    const arrow = { type: "draw_arrow", from: previousId, to: id, text: "" };
    previousId = id;
    return [action, arrow];
  });
}

function proposeDiagramExpansion(text) {
  if (state.scene !== "diagram" || !isDiagramExtensionText(text)) return false;
  const nodes = getDiagramNodes();
  if (!nodes.length) return false;
  const cleaned = stripDiagramExtensionText(text);
  if (isMeaningfulExtensionText(cleaned)) return false;

  const labels = semanticExpansionCandidates(nodes);
  if (!labels.length) {
    const message = "我还不确定该补哪些环节。请说“添加某某节点”，或说明要补充的具体步骤。";
    ui.analysisStatus.textContent = message;
    updateAiSummary({ rawText: text, summary: message, source: "voice-confirmation", actions: [] });
    addLog(message);
    speak(message);
    return true;
  }
  const actions = buildConfirmedExtensionActions(nodes, labels);
  const message = `我建议添加：${labels.join("、")}。请说“确认”执行，或说“取消”。`;
  pendingVoiceAction = {
    type: "diagram-expansion",
    actions,
    summary: message,
    createdAt: performance.now(),
  };
  ui.analysisStatus.textContent = message;
  updateAiSummary({ rawText: text, summary: message, source: "voice-confirmation", actions });
  updateActionChips(actions);
  addLog(message);
  speak(message);
  return true;
}

function handlePendingVoiceAction(text) {
  const normalized = normalizeText(text);
  if (!pendingVoiceAction) return false;
  if (includesAny(normalized, ["取消", "不用", "不要", "算了", "放弃"])) {
    const message = "已取消待执行的修改。";
    pendingVoiceAction = null;
    updateActionChips([]);
    ui.analysisStatus.textContent = message;
    addLog(message);
    speak(message);
    return true;
  }
  if (includesAny(normalized, ["确认", "执行", "可以", "就这样", "确定", "好"])) {
    const { actions } = pendingVoiceAction;
    pendingVoiceAction = null;
    executeActions(validateActions(actions));
    updateAiSummary({ rawText: text, summary: "已按确认执行扩展", source: "voice-confirmed", actions });
    addLog("已按确认执行扩展");
    speak("已执行");
    return true;
  }
  if (performance.now() - pendingVoiceAction.createdAt > 30000) {
    pendingVoiceAction = null;
  }
  return false;
}

function buildDiagramExtensionActions(text) {
  if (state.scene !== "diagram" || !isDiagramExtensionText(text)) return [];
  const nodes = getDiagramNodes();
  if (nodes.length === 0) return [];

  const cleaned = stripDiagramExtensionText(text);
  if (!cleaned && includesAny(text, ["复杂", "复杂化", "细化", "完善", "丰富", "展开"])) {
    const complexActions = buildLoginComplexityActions(nodes);
    if (complexActions.length) return complexActions;
  }

  if (!isMeaningfulExtensionText(cleaned)) return [];

  const nodeText = cleaned;
  const lastNode = nodes
    .map((node) => ({ node, box: getNodeBox(node) }))
    .sort((a, b) => a.box.x + a.box.width - (b.box.x + b.box.width))
    .at(-1);
  const id = `node_${Date.now()}`;
  const x = lastNode.box.x + lastNode.box.width + 74;
  const y = lastNode.box.y + Math.max(0, (lastNode.box.height - 64) / 2);
  return [
    { type: "draw_rect", id, text: nodeText, x, y, width: 150, height: 64, color: "#eef3ff" },
    { type: "draw_arrow", from: lastNode.node.id, to: id, text: "" },
  ];
}

function buildRenameNodeActions(text) {
  if (state.scene !== "diagram") return [];
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:把|将)(.+?)(?:改成|改为|改叫|重命名为)(.+)/);
  if (!match) return [];
  const fromText = match[1].replace(/节点|文字|名称/g, "").trim();
  const toText = match[2].replace(/节点|文字|名称/g, "").trim();
  if (!fromText || !toText) return [];
  const target = getDiagramNodes().find((node) => node.text.includes(fromText) || fromText.includes(node.text));
  if (!target) return [{ type: "ask_clarification", message: `没有找到“${fromText}”这个节点。` }];
  return [{ type: "rename_node", id: target.id, text: toText }];
}

function buildDeleteNodeActions(text) {
  if (state.scene !== "diagram") return [];
  const normalized = normalizeText(text);
  const match = normalized.match(/(?:删除|去掉|移除)(.+?)(?:节点|步骤|分支|$)/);
  if (!match) return [];
  const targetText = match[1].trim();
  if (!targetText) return [];
  const target = getDiagramNodes().find((node) => node.text.includes(targetText) || targetText.includes(node.text));
  if (!target) return [{ type: "ask_clarification", message: `没有找到“${targetText}”这个节点。` }];
  return [{ type: "delete_node", id: target.id }];
}

function buildSimplifyDiagramActions(text) {
  if (state.scene !== "diagram" || !includesAny(text, ["简化", "精简", "简单一点", "删繁"])) return [];
  const nodes = getDiagramNodes();
  if (nodes.length <= 4) return [{ type: "ask_clarification", message: "当前图已经比较简洁了。你想删除哪个节点？" }];
  return nodes.slice(4).map((node) => ({ type: "delete_node", id: node.id }));
}

function validateActions(actions) {
  if (!Array.isArray(actions)) return [];
  return actions
    .filter((action) => action && typeof action === "object" && allowedActionTypes.has(action.type))
    .map((action) => {
      if (action.type === "set_projectile_velocity") {
        return { type: action.type, value: clamp(Number(action.value), 1, 20) };
      }
      if (action.type === "set_projectile_height") {
        return { type: action.type, value: clamp(Number(action.value), 1, 8) };
      }
      if (action.type === "compare_projectile_velocity") {
        const values = Array.isArray(action.values) ? action.values : extractNumbers(action.text || "");
        return {
          type: action.type,
          values: values.map((value) => clamp(Number(value), 1, 20)).filter((value, index, list) => Number.isFinite(value) && list.indexOf(value) === index).slice(0, 4),
        };
      }
      if (action.type === "set_release_angle") {
        return { type: action.type, value: clamp(Number(action.value), 10, 160) };
      }
      if (action.type === "set_mass") {
        return { type: action.type, value: clamp(Number(action.value), 0.1, 100) };
      }
      if (action.type === "set_force") {
        return { type: action.type, value: clamp(Number(action.value), 0, 1000) };
      }
      if (action.type === "show_force") {
        return allowedForces.has(action.force) ? { type: action.type, force: action.force } : null;
      }
      if (action.type === "draw_rect" || action.type === "draw_box") {
        return {
          type: "draw_rect",
          id: String(action.id || action.text || `rect_${Date.now()}`),
          text: String(action.text ?? "节点"),
          x: clamp(Number(action.x), 40, 900),
          y: clamp(Number(action.y), 60, 620),
          width: clamp(Number(action.width || 130), 70, 260),
          height: clamp(Number(action.height || 56), 36, 140),
          color: String(action.color || "#eef3ff"),
        };
      }
      if (action.type === "draw_circle") {
        return {
          type: "draw_circle",
          id: String(action.id || action.text || `circle_${Date.now()}`),
          text: String(action.text ?? "节点"),
          x: clamp(Number(action.x), 40, 900),
          y: clamp(Number(action.y), 60, 620),
          radius: clamp(Number(action.radius || 38), 24, 90),
          color: String(action.color || "#e7f6ef"),
        };
      }
      if (action.type === "draw_arrow") {
        return {
          type: "draw_arrow",
          from: action.from ? String(action.from) : "",
          to: action.to ? String(action.to) : "",
          x1: Number.isFinite(Number(action.x1)) ? Number(action.x1) : null,
          y1: Number.isFinite(Number(action.y1)) ? Number(action.y1) : null,
          x2: Number.isFinite(Number(action.x2)) ? Number(action.x2) : null,
          y2: Number.isFinite(Number(action.y2)) ? Number(action.y2) : null,
          text: String(action.text || ""),
        };
      }
      if (action.type === "draw_line") {
        return {
          type: "draw_line",
          x1: Number.isFinite(Number(action.x1)) ? Number(action.x1) : 120,
          y1: Number.isFinite(Number(action.y1)) ? Number(action.y1) : 160,
          x2: Number.isFinite(Number(action.x2)) ? Number(action.x2) : 520,
          y2: Number.isFinite(Number(action.y2)) ? Number(action.y2) : 160,
          text: String(action.text || ""),
        };
      }
      if (action.type === "draw_text") {
        return {
          type: "draw_text",
          text: String(action.text || ""),
          x: clamp(Number(action.x), 24, 960),
          y: clamp(Number(action.y), 32, 660),
          size: clamp(Number(action.size || 16), 12, 36),
          color: String(action.color || "#17202a"),
        };
      }
      if (action.type === "ask_clarification") {
        return {
          type: "ask_clarification",
          message: String(action.message || "请再具体说明你想画什么图。"),
        };
      }
      if (action.type === "draw_template") {
        return {
          type: "draw_template",
          name: String(action.name || action.template || ""),
        };
      }
      if (action.type === "rename_node") {
        return {
          type: "rename_node",
          id: String(action.id || ""),
          text: String(action.text || ""),
        };
      }
      if (action.type === "delete_node") {
        return {
          type: "delete_node",
          id: String(action.id || ""),
        };
      }
      return { type: action.type };
    })
    .filter(Boolean);
}

function getProblemText() {
  return ui.problemText.value.trim();
}

function setList(element, items, formatter = (item) => item) {
  element.replaceChildren();
  const values = Array.isArray(items) ? items : [];
  if (values.length === 0) {
    const li = document.createElement("li");
    li.textContent = "暂无";
    element.append(li);
    return;
  }
  values.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = formatter(item);
    element.append(li);
  });
}

function normalizeProblemAnalysis(raw, source = "local-demo") {
  const analysis = raw && typeof raw === "object" ? raw : {};
  const sceneType = ["projectile", "circular_release", "inclined_plane", "horizontal_force", "diagram_plan", "unknown"].includes(analysis.sceneType)
    ? analysis.sceneType
    : "unknown";
  return {
    sceneType,
    knowledgePoints: Array.isArray(analysis.knowledgePoints) ? analysis.knowledgePoints.map(String) : [],
    knowns: Array.isArray(analysis.knowns) ? analysis.knowns : [],
    goals: Array.isArray(analysis.goals) ? analysis.goals.map(String) : [],
    steps: Array.isArray(analysis.steps) ? analysis.steps.map(String) : [],
    visualPlan: typeof analysis.visualPlan === "string" ? analysis.visualPlan : "当前版本暂未生成推荐图示。",
    actions: validateActions(analysis.actions),
    limitations: Array.isArray(analysis.limitations) ? analysis.limitations.map(String) : [],
    source: analysis.source || source,
    reply: typeof analysis.reply === "string" ? analysis.reply : "",
  };
}

function makeFlowActions(title, nodes, options = {}) {
  const startX = options.startX ?? 90;
  const y = options.y ?? 320;
  const gap = options.gap ?? 170;
  const actions = [{ type: "clear_canvas" }, { type: "draw_text", text: title, x: 54, y: 72, size: 24, color: "#17202a" }];
  nodes.forEach((node, index) => {
    const x = startX + index * gap;
    const id = node.id || `node_${index}`;
    actions.push({
      type: node.shape === "circle" ? "draw_circle" : "draw_rect",
      id,
      text: node.text,
      x,
      y: node.y ?? y,
      width: node.width ?? 150,
      height: node.height ?? 64,
      radius: node.radius ?? 42,
      color: node.color ?? "#eef3ff",
    });
    if (index > 0) {
      actions.push({ type: "draw_arrow", from: nodes[index - 1].id || `node_${index - 1}`, to: id, text: node.arrowText || "" });
    }
  });
  return actions;
}

function extractShapeText(text) {
  const match = text.match(/(?:写上|写入|写|标注|文字是|内容是)\s*([^ ]+)/);
  return match ? match[1].trim() : "";
}

function localPlanBasicShape(text) {
  const normalized = normalizeText(text);
  const label = extractShapeText(normalized);
  if (includesAny(normalized, ["圆周运动", "圆轨道", "圆形轨道"])) return null;
  if (includesAny(normalized, ["圆形", "圆圈", "一个圆", "画圆"])) {
    return {
      title: "圆形",
      source: "local-basic-shape",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_circle", id: "circle", text: label, x: 520, y: 350, radius: 82, color: "#ffffff" },
      ],
    };
  }
  if (includesAny(normalized, ["矩形", "长方形", "方框", "框形", "一个框", "画框"])) {
    return {
      title: "矩形",
      source: "local-basic-shape",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_rect", id: "rect", text: label, x: 430, y: 300, width: 220, height: 110, color: "#ffffff" },
      ],
    };
  }
  if (includesAny(normalized, ["箭头", "连线"])) {
    return {
      title: "箭头",
      source: "local-basic-shape",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_arrow", x1: 380, y1: 350, x2: 680, y2: 350, text: label },
      ],
    };
  }
  if (includesAny(normalized, ["写文字", "添加文字", "输入文字", "写上", "标注"])) {
    return {
      title: "文字",
      source: "local-basic-shape",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_text", text: label || normalized.replace(/(写文字|添加文字|输入文字|写上|标注)/g, "").trim() || "文字", x: 420, y: 350, size: 28, color: "#111827" },
      ],
    };
  }
  return null;
}

function localPlanGenericDiagram(text) {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["画一个系统", "一个系统", "系统图"]) && !includesAny(normalized, ["登录", "推荐", "前后端", "数据", "购物", "AI"])) {
    return {
      title: "需要补充信息",
      source: "local-clarification",
      actions: [{ type: "ask_clarification", message: "你想画哪类系统？例如登录系统、推荐系统、前后端系统，还是数据处理系统？" }],
    };
  }
  if (includesAny(normalized, ["在线购物", "购物流程", "下单流程", "电商流程"])) {
    return {
      title: "在线购物流程",
      source: "local-generalized",
      actions: makeFlowActions("在线购物流程", [
        { id: "browse", text: "选择商品" },
        { id: "cart", text: "加入购物车" },
        { id: "pay", text: "支付订单" },
        { id: "ship", text: "商家发货" },
        { id: "receive", text: "确认收货" },
      ], { startX: 80, y: 320, gap: 155 }),
    };
  }
  if (includesAny(normalized, ["用户请求", "数据库返回", "返回结果", "请求到数据库"])) {
    return {
      title: "请求响应流程",
      source: "local-generalized",
      actions: makeFlowActions("请求响应流程", [
        { id: "request", text: "用户请求" },
        { id: "frontend", text: "前端接收" },
        { id: "backend", text: "后端处理" },
        { id: "database", text: "查询数据库" },
        { id: "response", text: "返回结果" },
      ], { startX: 80, y: 320, gap: 155 }),
    };
  }
  return null;
}

function localPlanDrawing(text) {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["登录流程", "登陆流程", "登录流程图", "登陆流程图", "登录系统", "登陆系统", "登录过程", "登陆过程", "账号密码到登录成功"])) {
    return {
      title: "登录流程图",
      source: "local-template",
      actions: makeFlowActions("登录流程图", [
        { id: "start", text: "开始", shape: "circle", color: "#dff5ec" },
        { id: "input", text: "输入账号密码" },
        { id: "validate", text: "校验信息" },
        { id: "success", text: "登录成功", y: 250, color: "#dff5ec", arrowText: "通过" },
        { id: "fail", text: "登录失败", y: 390, color: "#ffe2e2", arrowText: "失败" },
      ], { startX: 100, y: 320, gap: 160 }),
    };
  }
  if (includesAny(normalized, ["前后端架构", "前后端框架", "前端后端", "前后端", "浏览器服务器", "浏览器 服务端", "架构图"])) {
    return {
      title: "前后端架构图",
      source: "local-template",
      actions: makeFlowActions("前后端架构图", [
        { id: "user", text: "用户", shape: "circle", color: "#dff5ec" },
        { id: "frontend", text: "前端页面" },
        { id: "api", text: "后端 API" },
        { id: "service", text: "业务服务" },
        { id: "db", text: "数据库", color: "#fff0ce" },
      ], { startX: 90, y: 320, gap: 150 }),
    };
  }
  if (includesAny(normalized, ["AI项目", "AI 项目", "AI应用", "AI 应用", "开发流程", "学习路线"])) {
    return {
      title: "AI 应用开发流程图",
      source: "local-template",
      actions: makeFlowActions("AI 应用开发流程图", [
        { id: "need", text: "需求输入", color: "#eef3ff" },
        { id: "data", text: "数据处理" },
        { id: "model", text: "模型调用", color: "#f2eafd" },
        { id: "parse", text: "结果解析" },
        { id: "guard", text: "异常处理", color: "#fff0ce" },
        { id: "monitor", text: "日志监控", color: "#dff5ec" },
      ], { startX: 58, y: 320, gap: 145 }),
    };
  }
  if (includesAny(normalized, ["平抛运动讲解图", "平抛讲解图"])) {
    return {
      title: "平抛运动讲解图",
      source: "local-template",
      actions: [
        { type: "draw_projectile" },
        { type: "show_velocity" },
        { type: "show_gravity" },
        { type: "show_trajectory" },
      ],
    };
  }
  if (includesAny(normalized, ["斜面受力分析图", "斜面受力图"])) {
    return {
      title: "斜面受力分析图",
      source: "local-template",
      actions: [
        { type: "draw_inclined_plane" },
        { type: "add_block" },
        { type: "show_force", force: "gravity" },
        { type: "show_force", force: "normal" },
        { type: "show_force", force: "friction" },
      ],
    };
  }
  return localPlanBasicShape(normalized) || localPlanGenericDiagram(normalized);
}

function resolveTemplatePlan(name) {
  const key = normalizeText(name).toLowerCase();
  const aliases = {
    projectile: "平抛运动讲解图",
    circular: "圆周运动",
    circular_release: "圆周运动",
    inclined: "斜面受力分析图",
    inclined_plane: "斜面受力分析图",
    login: "登录流程图",
    login_flow: "登录流程图",
    frontend_backend: "前后端架构图",
    architecture: "前后端架构图",
    ai_flow: "AI 应用开发流程图",
  };
  return localPlanDrawing(aliases[key] || name);
}

function renderProblemAnalysis(analysis) {
  const safe = normalizeProblemAnalysis(analysis, analysis?.source);
  problemAnalysis = safe;
  currentStepIndex = 0;
  ui.analysisScene.textContent = sceneTypeNames[safe.sceneType] ?? safe.sceneType;
  ui.analysisSource.textContent = safe.source;
  ui.visualPlan.textContent = safe.visualPlan;
  setList(ui.knowledgeList, safe.knowledgePoints);
  setList(ui.knownsList, safe.knowns, (item) => {
    if (typeof item === "string") return item;
    const value = item.value !== undefined && item.value !== null ? ` = ${item.value}` : "";
    const unit = item.unit ? item.unit : "";
    return `${item.name ?? "条件"} ${item.symbol ? `(${item.symbol})` : ""}${value}${unit}`;
  });
  setList(ui.goalsList, safe.goals);
  setList(ui.stepsList, safe.steps);
  setList(ui.limitationsList, safe.limitations.length ? safe.limitations : ["当前结果仅用于高中力学讲题图示辅助"]);
  updateAiSummary({
    summary: safe.reply || safe.visualPlan,
    source: safe.source,
    actions: safe.actions,
  });
}

function updateAiSummary({ rawText = state.lastTranscript, summary = "", source = "local", actions = [] } = {}) {
  if (ui.aiRawText) ui.aiRawText.textContent = rawText || "-";
  if (ui.aiSummary) ui.aiSummary.textContent = summary || "等待输入";
  if (ui.aiSource) ui.aiSource.textContent = source || "local";
  if (ui.aiActionCount) ui.aiActionCount.textContent = String(Array.isArray(actions) ? actions.length : 0);
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 22000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("AI 响应超时，请稍后重试或说得更具体一些");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function buildLlmProblemContext() {
  const context = problemAnalysis ? cloneState(problemAnalysis) : {};
  if (state.scene === "diagram") {
    context.currentDiagram = {
      title: state.diagram.title,
      nodes: getDiagramNodes().map((node) => ({
        id: node.id,
        text: node.text,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        radius: node.radius,
      })),
      arrows: state.diagram.elements
        .filter((element) => element.type === "draw_arrow")
        .map((arrow) => ({ from: arrow.from, to: arrow.to, text: arrow.text || "" })),
    };
  }
  return context;
}

function shouldStoreVoiceIntent(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (includesAny(normalized, ["停止监听", "关闭麦克风", "撤回", "撤销", "清空", "清除", "导出", "保存图片", "下载图片", "帮助", "怎么用", "有哪些指令"])) return false;
  if (state.scene === "diagram" && includesAny(normalized, ["复杂", "扩展", "扩容", "细化", "完善", "丰富", "添加", "删除", "改成", "重命名", "简化"])) return false;
  return includesAny(normalized, ["画", "生成", "设计", "流程", "流程图", "架构", "架构图", "关系图", "示意图", "平抛", "斜面", "圆周", "受力"]);
}

function showVoiceHelp() {
  const message = "可用语音：画一个员工入职流程图；生成购物流程图；复杂一点；对比初速度 3 6 9；添加短信验证码节点；删除某个节点；把某节点改成新名称；撤回；清空；导出图片。";
  ui.analysisStatus.textContent = message;
  updateAiSummary({ rawText: state.lastTranscript, summary: message, source: "voice-help", actions: [] });
  addLog(message);
  speak(message);
}

function localAnalyzeProblem(problemText) {
  const text = normalizeText(problemText);
  const numberToken = "[-0-9.零一二两三四五六七八九十]+";
  const height = extractNumber((text.match(new RegExp(`(?:离地|高度|高)[^0-9零一二两三四五六七八九十-]*${numberToken}`)) || [text])[0], 3);
  const velocitySource =
    (text.match(new RegExp(`${numberToken}\\s*(?:m/s|米每秒)[^，。]*速度`)) ||
      text.match(new RegExp(`(?:初速度|速度)[^0-9零一二两三四五六七八九十-]*${numberToken}`)) ||
      [text])[0];
  const velocity = extractNumber(velocitySource, 5);
  const angle = extractNumber((text.match(/(?:脱离角度|脱离角|倾角|成)[^0-9零一二两三四五六七八九十-]*[-0-9.零一二两三四五六七八九十]+/) || [text])[0], 60);
  const massSource = (text.match(new RegExp(`${numberToken}\\s*(?:kg|千克)[^，。]*?(?:物体|物块|质量)|(?:质量|质量为)[^0-9零一二两三四五六七八九十-]*${numberToken}`)) || [""])[0];
  const mass = hasNumber(massSource) ? extractNumber(massSource, 2) : null;
  const forceSource =
    (text.match(new RegExp(`(?:大小为|外力|水平力|拉力|推力)[^0-9零一二两三四五六七八九十-]*${numberToken}`)) ||
      text.match(new RegExp(`${numberToken}\\s*(?:N|牛|牛顿)[^，。]*?(?:水平力|外力|拉力|推力)`)) ||
      [""])[0];
  const force = hasNumber(forceSource) ? extractNumber(forceSource, 10) : null;

  if (includesAny(text, ["光滑水平面", "水平面", "水平力", "牛顿第二定律", "加速度", "合力", "受到一个大小为"])) {
    const isSmooth = text.includes("光滑");
    const hasValues = mass !== null && force !== null;
    const acceleration = hasValues && mass > 0 ? Number((force / mass).toFixed(2)) : null;
  const actions = [
      { type: "draw_horizontal_surface" },
      { type: "add_block" },
    ];
    if (mass !== null) actions.splice(2, 0, { type: "set_mass", value: mass });
    if (force !== null) actions.splice(mass !== null ? 3 : 2, 0, { type: "set_force", value: force });
    return normalizeProblemAnalysis({
      sceneType: "horizontal_force",
      knowledgePoints: isSmooth ? ["牛顿第二定律", "受力分析", "光滑水平面", "加速度与合力关系"] : ["受力分析", "水平面", "拉力", "支持力"],
      knowns: [
        ...(mass !== null ? [{ name: "质量", symbol: "m", value: mass, unit: "kg" }] : []),
        ...(force !== null ? [{ name: "水平外力", symbol: "F", value: force, unit: "N" }] : []),
      ],
      goals: ["求物体加速度", "分析物体受力"],
      steps: [
        isSmooth ? "光滑水平面表示摩擦力可以忽略" : "题目未说明水平面是否光滑，先画出确定存在的力",
        "竖直方向重力 G 与支持力 N 平衡",
        isSmooth ? "水平方向合力等于外力 F" : "水平方向存在向右拉力 F；若水平面粗糙，还可能存在与运动趋势相反的摩擦力",
        acceleration !== null ? `根据牛顿第二定律 a = F / m = ${force} / ${mass} = ${acceleration} m/s^2` : "题目未给出质量和拉力大小时，只能做定性受力分析，不能计算加速度数值",
      ],
      visualPlan: acceleration !== null ? "绘制水平面上的物块，标出重力 G、支持力 N、水平外力 F 和加速度 a。" : "绘制水平面上的物块，标出重力 G、支持力 N 和水平向右拉力 F。",
      actions,
      limitations: isSmooth ? ["当前版本按单物体、光滑水平面、恒定水平外力处理。"] : ["题目未说明是否粗糙，摩擦力是否存在需要结合题目条件判断。"],
      source: "local-demo",
    });
  }

  if (includesAny(text, ["平抛", "水平抛出", "平台", "落地时间", "水平位移"])) {
    return normalizeProblemAnalysis({
      sceneType: "projectile",
      knowledgePoints: ["平抛运动", "运动分解", "水平方向匀速直线运动", "竖直方向自由落体运动"],
      knowns: [
        { name: "高度", symbol: "h", value: height, unit: "m" },
        { name: "水平初速度", symbol: "v0", value: velocity, unit: "m/s" },
      ],
      goals: ["落地时间", "水平位移"],
      steps: ["竖直方向使用 h = 1/2gt^2 求落地时间", "水平方向使用 x = v0t 求水平位移", "结合图示理解水平和竖直运动互不影响"],
      visualPlan: "绘制平抛运动示意图，显示初速度、重力方向和抛物线轨迹。",
      actions: [
        { type: "draw_projectile" },
        { type: "set_projectile_height", value: height },
        { type: "set_projectile_velocity", value: velocity },
      ],
      limitations: ["本地演示分析基于关键词抽取，真实复杂题建议配置后端 LLM。"],
      source: "local-demo",
    });
  }

  if (includesAny(text, ["圆周", "圆轨道", "脱离", "切线"])) {
    return normalizeProblemAnalysis({
      sceneType: "circular_release",
      knowledgePoints: ["圆周运动", "切线速度", "脱离后抛体运动", "重力作用"],
      knowns: [{ name: "脱离角度", symbol: "theta", value: angle, unit: "度" }],
      goals: ["分析脱离后的运动轨迹"],
      steps: ["确定脱离点位置", "确定脱离瞬间速度沿轨道切线方向", "脱离后只受重力作用，按抛体运动分析"],
      visualPlan: "绘制竖直圆轨道、脱离点、切线速度箭头、重力箭头和脱离后的抛体轨迹。",
      actions: [
        { type: "draw_circular_track" },
        { type: "add_ball" },
        { type: "set_release_angle", value: angle },
      ],
      limitations: ["当前图示用于讲题示意，不求解竞赛级圆周约束条件。"],
      source: "local-demo",
    });
  }

  if (includesAny(text, ["斜面", "物块", "支持力", "摩擦力", "受力"])) {
    return normalizeProblemAnalysis({
      sceneType: "inclined_plane",
      knowledgePoints: ["受力分析", "重力分解", "支持力", "摩擦力", "平衡条件"],
      knowns: [{ name: "斜面倾角", symbol: "theta", value: angle, unit: "度" }],
      goals: ["分析物块所受的力"],
      steps: ["确定研究对象为物块", "标出重力，方向竖直向下", "标出支持力，方向垂直斜面向外", "根据运动趋势判断摩擦力方向"],
      visualPlan: "绘制斜面物块受力图，标出 G、N、f。",
      actions: [
        { type: "draw_inclined_plane" },
        { type: "add_block" },
      ],
      limitations: ["当前版本绘制受力方向，不做复杂多物体联立求解。"],
      source: "local-demo",
    });
  }

  return normalizeProblemAnalysis({
    sceneType: "unknown",
    knowledgePoints: [],
    knowns: [],
    goals: [],
    steps: [],
    visualPlan: "当前版本暂不支持该类题目。",
    actions: [],
    limitations: ["当前版本主要支持平抛、圆周脱离和斜面受力分析。"],
    source: "local-demo",
  });
}

async function analyzeProblem() {
  const problemText = getProblemText();
  if (!problemText) {
    ui.analysisStatus.textContent = "请先输入一个绘图意图。";
    speak("请先输入绘图意图");
    return;
  }

  const extensionActions = buildDiagramExtensionActions(problemText);
  if (extensionActions.length) {
    renderProblemAnalysis({
      sceneType: "diagram_plan",
      knowledgePoints: ["当前流程图扩展", "追加节点", "Canvas 自动绘制"],
      knowns: extensionActions.filter((action) => action.type.startsWith("draw_")).map((action) => action.text || action.type),
      goals: ["在现有流程图基础上继续补充节点"],
      steps: ["读取当前流程图", "找到最右侧节点", "追加新节点并连接箭头"],
      visualPlan: "扩展当前流程图",
      actions: extensionActions,
      limitations: [],
      source: "context-extension",
    });
    ui.analysisStatus.textContent = "已生成当前流程图的扩展规划。可以点击“生成图示”。";
    addLog("已生成当前流程图扩展规划");
    speak("已生成当前流程图扩展规划");
    return;
  }

  const templatePlan = localPlanDrawing(problemText);
  if (templatePlan) {
    renderProblemAnalysis({
      sceneType: "diagram_plan",
      knowledgePoints: ["一句话图示生成", "结构化绘图动作", "Canvas 自动绘制"],
      knowns: templatePlan.actions.filter((action) => action.type.startsWith("draw_")).map((action) => action.text || action.type),
      goals: ["把简单语音意图扩展成完整图示"],
      steps: ["理解用户意图", "补全图示节点和关系", "生成结构化 actions", "Canvas 执行动作"],
      visualPlan: templatePlan.title,
      actions: templatePlan.actions,
      limitations: ["当前为本地模板规划；更开放的模糊意图可由 LLM 扩展。"],
      source: templatePlan.source,
    });
    ui.analysisStatus.textContent = "图示规划完成。可以点击“生成图示”或说“生成图示”。";
    addLog(`图示规划完成：${templatePlan.title}`);
    speak("图示规划完成");
    return;
  }

  ui.analysisStatus.textContent = "正在扩展绘图意图...";
  updateStatus("正在扩展绘图意图");
  try {
    const localPhysics = localAnalyzeProblem(problemText);
    if (localPhysics.sceneType === "unknown") {
      const commandPlan = await fetchJsonWithTimeout("/api/parse-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: problemText, problemContext: buildLlmProblemContext() }),
      });
      if (commandPlan) {
        const actions = validateActions(commandPlan.actions);
        if (actions.length) {
          renderProblemAnalysis({
            sceneType: "diagram_plan",
            knowledgePoints: ["LLM 意图扩展", "结构化绘图动作"],
            knowns: actions.filter((action) => action.type.startsWith("draw_")).map((action) => action.text || action.type),
            goals: ["生成完整图示"],
            steps: ["理解自然语言意图", "补全图示结构", "输出 actions", "Canvas 绘制"],
            visualPlan: commandPlan.reply || "已生成图示规划",
            actions,
            limitations: [],
            source: commandPlan.source || "llm",
          });
          if (commandPlan.source?.startsWith("llm")) {
            stats.aiCalls += 1;
            updateStats();
          }
          ui.analysisStatus.textContent = "图示规划完成。可以点击“生成图示”。";
          addLog(commandPlan.reply || "图示规划完成");
          speak("图示规划完成");
          return;
        }
        if (commandPlan.source === "ai-disabled" || commandPlan.llmError) {
          ui.analysisStatus.textContent = commandPlan.reply || `LLM 调用失败：${commandPlan.llmError}`;
          updateAiSummary({
            rawText: problemText,
            summary: commandPlan.reply || `LLM 调用失败：${commandPlan.llmError}`,
            source: commandPlan.source || "llm-error",
            actions,
          });
          addLog(commandPlan.reply || `LLM 调用失败：${commandPlan.llmError}`);
          speak(commandPlan.reply || "AI 绘图未启用");
          return;
        }
      }
    }

    const rawAnalysis = await fetchJsonWithTimeout("/api/analyze-problem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problemText }),
    });
    let analysis = normalizeProblemAnalysis(rawAnalysis, "llm");
    const local = localAnalyzeProblem(problemText);
    if ((analysis.sceneType === "unknown" || analysis.actions.length === 0) && local.sceneType !== "unknown") {
      analysis = {
        ...local,
        source: "llm-fallback-local",
        limitations: ["LLM 未返回可执行图示，已使用本地题型识别补全。", ...local.limitations],
      };
    }
    if (analysis.source?.startsWith("llm")) {
      stats.aiCalls += 1;
      updateStats();
    }
    renderProblemAnalysis(analysis);
    ui.analysisStatus.textContent = "规划完成。可以说“生成图示”或“做受力分析”。";
    addLog(`图示规划完成：${sceneTypeNames[analysis.sceneType]}`);
    speak("图示规划完成");
  } catch (error) {
    const fallback = localAnalyzeProblem(problemText);
    renderProblemAnalysis(fallback);
    ui.analysisStatus.textContent = "未连接到 LLM 代理，已使用本地模板/演示规划。";
    addLog(`图示规划使用本地兜底：${error.message}`);
    speak("已使用本地规划");
  }
  updateStatus(listening ? "正在监听" : "监听已暂停", listening ? "ok" : "warn");
}

function drawProblemPlan() {
  const problemText = getProblemText();
  const extensionActions = buildDiagramExtensionActions(problemText);
  if (extensionActions.length) {
    executeActions(extensionActions);
    addLog("已扩展当前流程图");
    speak("已扩展当前流程图");
    return;
  }

  const templatePlan = problemText ? localPlanDrawing(problemText) : null;
  if (templatePlan) {
    renderProblemAnalysis({
      sceneType: "diagram_plan",
      knowledgePoints: ["一句话图示生成"],
      knowns: templatePlan.actions.filter((action) => action.type.startsWith("draw_")).map((action) => action.text || action.type),
      goals: ["生成完整图示"],
      steps: ["扩展意图", "生成 actions", "绘制 Canvas"],
      visualPlan: templatePlan.title,
      actions: templatePlan.actions,
      limitations: [],
      source: templatePlan.source,
    });
  } else if (!problemAnalysis && problemText) {
    renderProblemAnalysis(localAnalyzeProblem(problemText));
  }
  if (problemAnalysis && problemAnalysis.actions.length === 0 && problemText) {
    const local = localAnalyzeProblem(problemText);
    if (local.actions.length > 0) {
      renderProblemAnalysis({
        ...local,
        source: "local-actions",
        limitations: ["当前分析结果没有可执行图示，已使用本地题型识别生成受力图。", ...local.limitations],
      });
    }
  }
  if (!problemAnalysis || problemAnalysis.actions.length === 0) {
    addLog("没有可执行的题目图示动作");
    speak("当前题目没有可执行的图示动作");
    return;
  }
  executeActions(problemAnalysis.actions);
  addLog("已根据题目分析生成图示");
  speak("已根据题目画出示意图");
}

function buildForceAnalysisActions(analysis = problemAnalysis) {
  const sceneType = analysis?.sceneType;
  if (sceneType === "horizontal_force" || state.scene === "horizontal") {
    const actions = [
      { type: "draw_horizontal_surface" },
      { type: "add_block" },
    ];
    if (analysis?.knowns) {
      const mass = analysis.knowns.find((item) => item.symbol === "m")?.value;
      const force = analysis.knowns.find((item) => item.symbol === "F")?.value;
      if (Number.isFinite(Number(mass))) actions.push({ type: "set_mass", value: Number(mass) });
      if (Number.isFinite(Number(force))) actions.push({ type: "set_force", value: Number(force) });
    }
    actions.push(
      { type: "show_force", force: "gravity" },
      { type: "show_force", force: "normal" },
      { type: "show_applied_force" },
    );
    const mass = analysis?.knowns?.find((item) => item.symbol === "m")?.value ?? state.horizontal.mass;
    const force = analysis?.knowns?.find((item) => item.symbol === "F")?.value ?? state.horizontal.force;
    if (mass !== null && mass !== undefined && force !== null && force !== undefined) {
      actions.push({ type: "show_acceleration" });
    }
    return actions;
  }
  if (sceneType === "inclined_plane" || state.scene === "inclined") {
    return [
      { type: "draw_inclined_plane" },
      { type: "add_block" },
      { type: "show_force", force: "gravity" },
      { type: "show_force", force: "normal" },
      { type: "show_force", force: "friction" },
    ];
  }
  if (sceneType === "projectile" || state.scene === "projectile") {
    return [
      { type: "show_velocity" },
      { type: "show_gravity" },
      { type: "show_trajectory" },
    ];
  }
  if (sceneType === "circular_release" || state.scene === "circular") {
    return [
      { type: "show_velocity" },
      { type: "show_gravity" },
      { type: "show_trajectory" },
    ];
  }
  return [];
}

function drawForceAnalysis() {
  if (!problemAnalysis && getProblemText()) {
    renderProblemAnalysis(localAnalyzeProblem(getProblemText()));
  }
  const actions = validateActions(buildForceAnalysisActions(problemAnalysis));
  if (actions.length === 0) {
    addLog("当前场景没有可执行的受力分析动作");
    speak("当前场景没有可执行的受力分析动作");
    return;
  }
  executeActions(actions);
  addLog("已根据当前题目绘制受力分析");
  speak("已绘制受力分析");
}

function speakProblemStep(index) {
  if (!problemAnalysis || problemAnalysis.steps.length === 0) {
    speak("还没有题目分析步骤");
    addLog("还没有题目分析步骤");
    return;
  }
  const safeIndex = clamp(index, 0, problemAnalysis.steps.length - 1);
  currentStepIndex = safeIndex;
  const reply = `第 ${safeIndex + 1} 步：${problemAnalysis.steps[safeIndex]}`;
  addLog(reply);
  speak(reply);
}

function speakKnowledgePoints() {
  if (!problemAnalysis || problemAnalysis.knowledgePoints.length === 0) {
    speak("还没有知识点分析");
    addLog("还没有知识点分析");
    return;
  }
  const reply = `这道题涉及：${problemAnalysis.knowledgePoints.join("、")}`;
  addLog(reply);
  speak(reply);
}

function stopListeningByVoice() {
  wantsListening = false;
  listening = false;
  recognition?.stop();
  ui.micButton.classList.remove("listening");
  ui.micLabel.textContent = "继续监听";
  updateStatus("监听已暂停", "warn");
  addLog("已按语音指令停止监听");
  speak("已停止监听");
}

function handleProblemCommand(text) {
  const normalized = normalizeText(text);
  if (handlePendingVoiceAction(normalized)) {
    return true;
  }
  if (pendingVoiceAction) {
    pendingVoiceAction = null;
    updateActionChips([]);
  }
  if (includesAny(normalized, ["帮助", "怎么用", "有哪些指令", "指令列表", "可以说什么"])) {
    showVoiceHelp();
    return true;
  }
  if (includesAny(normalized, ["停止监听", "关闭麦克风", "关掉麦克风", "不要听了", "别听了", "停止收音", "停止语音"])) {
    stopListeningByVoice();
    return true;
  }
  const editActions = [
    ...buildRenameNodeActions(normalized),
    ...buildDeleteNodeActions(normalized),
    ...buildSimplifyDiagramActions(normalized),
  ];
  if (editActions.length) {
    executeActions(validateActions(editActions));
    updateAiSummary({ rawText: text, summary: "已按语音修改当前图示", source: "local-edit", actions: editActions });
    return true;
  }
  const extensionActions = buildDiagramExtensionActions(normalized);
  if (extensionActions.length) {
    executeActions(extensionActions);
    addLog("已扩展当前流程图");
    speak("已扩展当前流程图");
    return true;
  }
  if (proposeDiagramExpansion(normalized)) {
    return true;
  }
  if (includesAny(normalized, ["分析题目", "分析这道题", "看一下题目", "扩展意图", "规划图示", "生成规划"])) {
    analyzeProblem();
    return true;
  }
  if (includesAny(normalized, ["根据题目画图", "画出示意图", "推荐图示", "生成图示", "开始绘图", "画出来"])) {
    drawProblemPlan();
    return true;
  }
  if ((problemAnalysis || getProblemText()) && includesAny(normalized, ["受力分析", "受力图", "受力绘图", "标出所有力", "分析受力", "画出所有力"])) {
    drawForceAnalysis();
    return true;
  }
  if (includesAny(normalized, ["列出知识点", "知识点"])) {
    speakKnowledgePoints();
    return true;
  }
  if (includesAny(normalized, ["讲第一步", "第一步"])) {
    speakProblemStep(0);
    return true;
  }
  if (includesAny(normalized, ["讲第二步", "第二步"])) {
    speakProblemStep(1);
    return true;
  }
  if (includesAny(normalized, ["讲第三步", "第三步"])) {
    speakProblemStep(2);
    return true;
  }
  if (includesAny(normalized, ["讲下一步", "下一步"])) {
    const nextIndex = Math.min(currentStepIndex + 1, Math.max(0, (problemAnalysis?.steps.length ?? 1) - 1));
    speakProblemStep(nextIndex);
    return true;
  }
  if (includesAny(normalized, ["为什么", "解释"])) {
    if (problemAnalysis?.steps[currentStepIndex]) {
      const reply = `这一步的核心是：${problemAnalysis.steps[currentStepIndex]}。图示用于把抽象运动或受力关系可视化。`;
      addLog(reply);
      speak(reply);
      return true;
    }
  }
  return false;
}

function parseCommand(text) {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const actions = [];
  const clauses = normalized
    .split(/(?:然后|并且|同时|接着|顺便|以及|并|且)/)
    .map((item) => item.trim())
    .filter(Boolean);
  const segments = clauses.length ? clauses : [normalized];

  const pushUnique = (action) => {
    const key = JSON.stringify(action);
    if (!actions.some((item) => JSON.stringify(item) === key)) {
      actions.push(action);
    }
  };

  if (includesAny(normalized, ["撤回", "撤销", "回退", "退一步", "上一步"])) {
    pushUnique({ type: "undo" });
    return actions;
  }
  if (includesAny(normalized, ["清空", "清除", "擦掉", "重置画布"])) {
    pushUnique({ type: "clear_canvas" });
    return actions;
  }
  if (includesAny(normalized, ["暂停", "停一下", "停止模拟"])) {
    pushUnique({ type: "pause_simulation" });
  }
  if (includesAny(normalized, ["重播", "重新播放", "重新模拟", "再播放"])) {
    pushUnique({ type: "replay_simulation" });
  }
  if (includesAny(normalized, ["导出", "保存图片", "下载图片"])) {
    pushUnique({ type: "export_image" });
  }
  if (includesAny(normalized, ["对比初速度", "比较初速度", "初速度对比", "速度对比", "对比速度"])) {
    const values = extractNumbers(normalized);
    pushUnique({ type: "compare_projectile_velocity", values: values.length >= 2 ? values : [3, 5, 7] });
    return actions;
  }

  const extensionActions = buildDiagramExtensionActions(normalized);
  if (extensionActions.length) {
    return extensionActions;
  }

  const templatePlan = localPlanDrawing(normalized);
  if (templatePlan) {
    return validateActions(templatePlan.actions);
  }

  for (const segment of segments) {
    if (includesAny(segment, ["平抛", "水平抛出", "抛物线"])) {
      pushUnique({ type: "draw_projectile" });
    }
    if (includesAny(segment, ["竖直圆轨道", "圆轨道", "圆周", "圆形轨道"])) {
      pushUnique({ type: "draw_circular_track" });
    }
    if (includesAny(segment, ["斜面", "坡面"])) {
      pushUnique({ type: "draw_inclined_plane" });
    }
    if (includesAny(segment, ["水平面", "光滑水平面", "水平受力"])) {
      pushUnique({ type: "draw_horizontal_surface" });
    }
    if (includesAny(segment, ["小球", "球"])) {
      pushUnique({ type: "add_ball" });
    }
    if (includesAny(segment, ["物块", "方块", "滑块"])) {
      pushUnique({ type: "add_block" });
    }
    if (includesAny(segment, ["质量"])) {
      pushUnique({ type: "set_mass", value: extractNumberAfterKeywords(segment, ["质量", "质量为", "质量设为"], 2) });
    }
    if (includesAny(segment, ["外力", "水平力", "拉力", "推力"])) {
      pushUnique({ type: "set_force", value: extractNumberAfterKeywords(segment, ["外力", "水平力", "拉力", "推力"], 10) });
    }
    if (includesAny(segment, ["初速度", "速度设为", "速度设置", "速度改成", "速度调到"])) {
      pushUnique({ type: "set_projectile_velocity", value: extractNumberAfterKeywords(segment, ["初速度", "速度设为", "速度设置", "速度改成", "速度调到", "速度"], 5) });
    }
    if (includesAny(segment, ["高度", "高为", "高设为", "高度设为", "高度改成", "高度调到", "换高度", "改高度"])) {
      pushUnique({ type: "set_projectile_height", value: extractNumberAfterKeywords(segment, ["高度设为", "高度改成", "高度调到", "换高度", "改高度", "高度", "高为", "高设为"], 3) });
    }
    if (includesAny(segment, ["脱离角", "脱离角度", "释放角", "离开角度"])) {
      pushUnique({ type: "set_release_angle", value: extractNumberAfterKeywords(segment, ["脱离角度", "脱离角", "释放角", "离开角度"], 60) });
    }
    if (includesAny(segment, ["重力", "重力方向", "标出g", "显示g"])) {
      pushUnique({ type: "show_force", force: "gravity" });
    }
    if (includesAny(segment, ["支持力", "法向力"])) {
      pushUnique({ type: "show_force", force: "normal" });
    }
    if (includesAny(segment, ["摩擦力", "摩擦"])) {
      pushUnique({ type: "show_force", force: "friction" });
    }
    if (includesAny(segment, ["速度方向", "速度箭头", "切线方向", "显示速度"])) {
      pushUnique({ type: "show_velocity" });
    }
    if (includesAny(segment, ["显示外力", "标出外力", "水平外力"])) {
      pushUnique({ type: "show_applied_force" });
    }
    if (includesAny(segment, ["显示加速度", "标出加速度", "加速度方向"])) {
      pushUnique({ type: "show_acceleration" });
    }
    if (includesAny(segment, ["轨迹", "运动轨迹"])) {
      pushUnique({ type: "show_trajectory" });
    }
    if (includesAny(segment, ["开始", "模拟", "播放", "运行"])) {
      pushUnique({ type: "start_simulation" });
    }
  }

  if (actions.length === 0 && normalized.length > 4) {
    actions.push({ type: "llm_fallback", text: normalized });
  }
  return actions;
}

async function fallbackToLLM(text) {
  if (typeof window.EDUSKETCH_LLM_PARSE === "function") {
    try {
      stats.aiCalls += 1;
      updateStats();
      const result = await window.EDUSKETCH_LLM_PARSE(text);
      const actions = validateActions(result);
      if (actions.length) {
        executeActions(actions);
        return;
      }
    } catch (error) {
      addLog(`LLM 兜底失败：${error.message}`);
    }
  }
  try {
    const result = await fetchJsonWithTimeout("/api/parse-command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, problemContext: buildLlmProblemContext() }),
    });
    stats.aiCalls += result.source?.startsWith("llm") ? 1 : 0;
    updateStats();
    const actions = validateActions(result.actions);
    if (result.llmError) {
      ui.analysisStatus.textContent = `LLM 调用失败：${result.llmError}`;
      addLog(`LLM 调用失败：${result.llmError}`);
    }
    updateAiSummary({
      rawText: text,
      summary: result.llmError ? `LLM 调用失败：${result.llmError}` : result.reply || result.summary || "已生成图示规划",
      source: result.source || "llm",
      actions,
    });
    if (actions.length) {
      executeActions(actions);
      if (result.reply) {
        addLog(result.reply);
        speak(result.reply);
      }
      return;
    }
    if (result.source === "ai-disabled") {
      if (result.reply) {
        addLog(result.reply);
        speak(result.reply);
      }
      return;
    }
    if (result.reply) {
      addLog(result.reply);
      speak(result.reply);
    }
  } catch (error) {
    addLog(`上下文指令解析失败：${error.message}`);
  }
  addLog("这句指令暂时无法转成绘图动作");
  speak("这句指令我还没有学会");
}

function actionToText(action) {
  if (action.type === "set_projectile_velocity") {
    return `已设置初速度 ${action.value}`;
  }
  if (action.type === "set_projectile_height") {
    return `已设置高度 ${action.value}`;
  }
  if (action.type === "compare_projectile_velocity") {
    return `已对比初速度 ${action.values.join("、")}`;
  }
  if (action.type === "set_release_angle") {
    return `已设置脱离角度 ${action.value} 度`;
  }
  if (action.type === "set_mass") {
    return `已设置质量 ${action.value} kg`;
  }
  if (action.type === "set_force") {
    return `已设置外力 ${action.value} N`;
  }
  if (action.type === "show_force") {
    const names = { gravity: "重力", normal: "支持力", friction: "摩擦力" };
    return `已标出${names[action.force]}`;
  }
  return actionLabels[action.type] ?? action.type;
}

function executeActions(actions) {
  state.lastActions = actions;
  updateActionChips(actions);
  for (const action of actions) {
    executeAction(action);
  }
  updateParams();
  render();
}

function executeAction(action) {
  if (action.type === "undo") {
    restorePrevious();
    return;
  }
  if (action.type === "llm_fallback") {
    fallbackToLLM(action.text);
    return;
  }
  if (action.type === "ask_clarification") {
    ui.analysisStatus.textContent = action.message;
    updateAiSummary({ summary: action.message, source: "clarification", actions: [action] });
    addLog(action.message);
    speak(action.message);
    return;
  }
  if (action.type === "draw_template") {
    const plan = resolveTemplatePlan(action.name);
    if (plan?.actions?.length) {
      executeActions(plan.actions);
      addLog(`已调用模板：${action.name}`);
    } else {
      addLog(`未找到模板：${action.name}`);
      speak("没有找到对应模板");
    }
    return;
  }
  if (action.type === "rename_node") {
    remember();
    const target = state.diagram.elements.find((element) => (element.type === "draw_rect" || element.type === "draw_circle") && element.id === action.id);
    if (target && action.text) {
      target.text = action.text;
      addLog(`已重命名节点为：${action.text}`);
      speak("已修改节点名称");
      render();
    }
    return;
  }
  if (action.type === "delete_node") {
    remember();
    state.diagram.elements = state.diagram.elements.filter((element) => {
      if ((element.type === "draw_rect" || element.type === "draw_circle") && element.id === action.id) return false;
      if (element.type === "draw_arrow" && (element.from === action.id || element.to === action.id)) return false;
      return true;
    });
    addLog("已删除节点");
    speak("已删除节点");
    render();
    return;
  }

  remember();
  switch (action.type) {
    case "draw_projectile":
      state.scene = "projectile";
      state.projectile = { ...cloneState(defaultState.projectile), velocity: state.projectile.velocity, height: state.projectile.height, ball: true };
      state.animation = { running: false, mode: "projectile", startMs: 0, elapsed: 0 };
      break;
    case "set_projectile_velocity":
      state.projectile.velocity = clamp(action.value, 1, 20);
      state.projectile.compareVelocities = [];
      break;
    case "set_projectile_height":
      state.projectile.height = clamp(action.value, 1, 8);
      break;
    case "compare_projectile_velocity":
      state.scene = "projectile";
      state.projectile.compareVelocities = action.values.length ? action.values : [3, 5, 7];
      state.projectile.velocity = state.projectile.compareVelocities[0];
      state.projectile.showTrajectory = true;
      state.projectile.showGravity = true;
      state.projectile.ball = true;
      state.animation = { running: false, mode: null, startMs: 0, elapsed: 0 };
      break;
    case "draw_circular_track":
      state.scene = "circular";
      state.circular = { ...cloneState(defaultState.circular), releaseAngle: state.circular.releaseAngle, ball: true };
      state.animation = { running: false, mode: "circular", startMs: 0, elapsed: 0 };
      break;
    case "add_ball":
      if (state.scene === "circular") state.circular.ball = true;
      else {
        state.scene = "projectile";
        state.projectile.ball = true;
      }
      break;
    case "set_release_angle":
      state.circular.releaseAngle = clamp(action.value, 10, 160);
      state.scene = "circular";
      state.circular.ball = true;
      break;
    case "draw_inclined_plane":
      state.scene = "inclined";
      state.inclined = cloneState(defaultState.inclined);
      state.animation = { running: false, mode: null, startMs: 0, elapsed: 0 };
      break;
    case "draw_horizontal_surface":
      state.scene = "horizontal";
      state.horizontal = cloneState(defaultState.horizontal);
      state.horizontal.block = true;
      state.animation = { running: false, mode: null, startMs: 0, elapsed: 0 };
      break;
    case "add_block":
      if (state.scene === "horizontal") {
        state.horizontal.block = true;
      } else {
        state.scene = "inclined";
        state.inclined.block = true;
      }
      break;
    case "set_mass":
      state.scene = "horizontal";
      state.horizontal.block = true;
      state.horizontal.mass = action.value;
      break;
    case "set_force":
      state.scene = "horizontal";
      state.horizontal.block = true;
      state.horizontal.force = action.value;
      break;
    case "show_force":
      if (state.scene === "inclined") {
        state.inclined.forces[action.force] = true;
      } else if (state.scene === "horizontal") {
        if (action.force === "gravity") state.horizontal.showGravity = true;
        if (action.force === "normal") state.horizontal.showNormal = true;
      } else if (action.force === "gravity") {
        state.projectile.showGravity = true;
        state.circular.showGravity = true;
      }
      break;
    case "show_applied_force":
      state.scene = "horizontal";
      state.horizontal.block = true;
      state.horizontal.showAppliedForce = true;
      break;
    case "show_acceleration":
      state.scene = "horizontal";
      state.horizontal.block = true;
      state.horizontal.showAcceleration = true;
      break;
    case "show_trajectory":
      if (state.scene === "circular") state.circular.showTrail = true;
      else if (state.scene === "projectile") state.projectile.showTrajectory = true;
      break;
    case "show_velocity":
      if (state.scene === "circular") state.circular.showVelocity = true;
      else state.projectile.showVelocity = true;
      break;
    case "show_gravity":
      state.projectile.showGravity = true;
      state.circular.showGravity = true;
      break;
    case "start_simulation":
      if (state.scene === "projectile" || state.scene === "circular") {
        if (state.scene === "projectile") state.projectile.showTrajectory = true;
        if (state.scene === "circular") state.circular.showTrail = true;
        state.animation.running = true;
        state.animation.mode = state.scene;
        state.animation.startMs = performance.now();
        state.animation.elapsed = 0;
      }
      break;
    case "pause_simulation":
      state.animation.running = false;
      break;
    case "replay_simulation":
      if (state.scene === "projectile" || state.scene === "circular") {
        state.animation.running = true;
        state.animation.mode = state.scene;
        state.animation.startMs = performance.now();
        state.animation.elapsed = 0;
      }
      break;
    case "clear_canvas":
      state = cloneState(defaultState);
      break;
    case "export_image":
      exportImage();
      break;
    case "draw_rect":
    case "draw_circle":
    case "draw_arrow":
    case "draw_line":
    case "draw_text":
      state.scene = "diagram";
      state.diagram.elements.push(action);
      state.animation = { running: false, mode: null, startMs: 0, elapsed: 0 };
      break;
  }

  const text = actionToText(action);
  addLog(text);
  speak(text);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function addLog(message) {
  const li = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  li.append(time, document.createTextNode(message));
  ui.log.prepend(li);
  while (ui.log.children.length > 80) {
    ui.log.lastElementChild.remove();
  }
}

function updateActionChips(actions) {
  ui.actions.replaceChildren();
  for (const action of actions) {
    const chip = document.createElement("span");
    chip.className = "action-chip";
    chip.textContent = action.type;
    ui.actions.append(chip);
  }
}

function updateStatus(text, mode = "ok") {
  ui.status.textContent = text;
  ui.status.classList.toggle("warn", mode === "warn");
  ui.status.classList.toggle("error", mode === "error");
}

function updateParams() {
  ui.paramScene.textContent = sceneNames[state.scene];
  ui.paramVelocity.textContent = String(state.projectile.velocity);
  ui.paramHeight.textContent = String(state.projectile.height);
  ui.paramAngle.textContent = `${state.circular.releaseAngle}°`;
  ui.paramForce.textContent = state.horizontal.force === null ? "未给出" : `${state.horizontal.force}N`;
  ui.paramMass.textContent = state.horizontal.mass === null ? "未给出" : `${state.horizontal.mass}kg`;
}

function updateStats() {
  ui.parseCount.textContent = String(stats.localParseCount);
  ui.aiCalls.textContent = String(stats.aiCalls);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  if (listening || wantsListening) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "zh-CN";
  utterance.rate = 1.08;
  window.speechSynthesis.speak(utterance);
}

function setupSpeech() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    updateStatus("当前浏览器不支持语音识别", "error");
    ui.micLabel.textContent = "语音不可用";
    ui.micButton.disabled = true;
    return;
  }

  recognition = new Recognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    listening = true;
    ui.micButton.classList.add("listening");
    ui.micLabel.textContent = "正在监听";
    updateStatus("正在监听");
  };

  recognition.onend = () => {
    listening = false;
    ui.micButton.classList.remove("listening");
    if (wantsListening) {
      ui.micLabel.textContent = "正在恢复监听";
      updateStatus("正在恢复监听", "warn");
      window.setTimeout(() => {
        if (wantsListening && !listening) startListening();
      }, 350);
      return;
    }
    ui.micLabel.textContent = "继续监听";
    updateStatus("监听已暂停", "warn");
  };

  recognition.onerror = (event) => {
    updateStatus(`语音识别异常：${event.error}`, "error");
    addLog(`语音识别异常：${event.error}`);
    if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
      wantsListening = false;
    }
  };

  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result[0].transcript.trim();
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (interim) {
      ui.transcript.textContent = interim;
    }
    if (finalText) {
      handleTranscript(finalText);
    }
  };
}

function startListening() {
  if (!recognition || listening) return;
  wantsListening = true;
  try {
    recognition.start();
  } catch (error) {
    addLog(`启动监听失败：${error.message}`);
  }
}

function shouldIgnoreRepeatedSpeech(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  const now = performance.now();
  if (normalized === lastHandledSpeech.text && now - lastHandledSpeech.time < 2500) {
    return true;
  }
  lastHandledSpeech = { text: normalized, time: now };
  return false;
}

function handleTranscript(text) {
  if (shouldIgnoreRepeatedSpeech(text)) {
    return;
  }
  state.lastTranscript = text;
  ui.transcript.textContent = text;
  if (shouldStoreVoiceIntent(text)) {
    ui.problemText.value = text;
  }
  if (handleProblemCommand(text)) {
    return;
  }
  const actions = parseCommand(text);
  stats.localParseCount += 1;
  updateStats();
  if (actions.length === 0) {
    updateActionChips([]);
    addLog(`未识别为有效指令：${text}`);
    speak("没有识别到可执行的绘图指令");
    return;
  }
  updateAiSummary({ rawText: text, summary: "本地规则已解析为可执行绘图动作", source: "local", actions });
  executeActions(actions);
}

function exportImage() {
  const link = document.createElement("a");
  link.download = `edusketch-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(640, Math.floor(rect.width * ratio));
  canvas.height = Math.max(420, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  render();
}

function clearBoard() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfcfe";
  ctx.fillRect(0, 0, width, height);
  drawGrid(width, height);
}

function drawGrid(width, height) {
  ctx.save();
  ctx.strokeStyle = "#edf1f5";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    line(x, 0, x, height);
  }
  for (let y = 0; y < height; y += 32) {
    line(0, y, width, y);
  }
  ctx.restore();
}

function render() {
  clearBoard();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  drawBoardTitle(width);
  if (state.scene === "projectile") drawProjectile(width, height);
  else if (state.scene === "circular") drawCircular(width, height);
  else if (state.scene === "inclined") drawInclined(width, height);
  else if (state.scene === "horizontal") drawHorizontal(width, height);
  else if (state.scene === "diagram") drawDiagram(width, height);
  else drawEmpty(width, height);
}

function drawBoardTitle(width) {
  ctx.save();
  ctx.fillStyle = "#17202a";
  ctx.font = "700 18px Microsoft YaHei, sans-serif";
  ctx.fillText(sceneNames[state.scene], 24, 34);
  ctx.restore();
}

function drawEmpty(width, height) {
  ctx.save();
  ctx.fillStyle = "#667085";
  ctx.font = "18px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("等待语音指令生成图示", width / 2, height / 2);
  ctx.restore();
}

function drawProjectile(width, height) {
  const baseY = Math.min(height - 90, height * 0.78);
  const startX = Math.max(80, width * 0.12);
  const startY = baseY - state.projectile.height * 58;
  const v0 = state.projectile.velocity;
  const compareVelocities = state.projectile.compareVelocities || [];
  const duration = Math.max(1.6, Math.sqrt((2 * Math.max(1, state.projectile.height)) / 9.8) * 1.35);
  const currentT = state.animation.mode === "projectile" ? Math.min(state.animation.elapsed / 1000, duration) : 0;
  const ball = getProjectilePosition(currentT, startX, startY, v0);

  ctx.save();
  ctx.strokeStyle = "#394957";
  ctx.lineWidth = 4;
  line(42, baseY, width - 36, baseY);
  ctx.fillStyle = "#dbeafe";
  ctx.fillRect(startX - 55, startY, 76, baseY - startY);
  ctx.strokeStyle = "#7c8a99";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX - 55, startY, 76, baseY - startY);

  if (compareVelocities.length) {
    const colors = ["#2563eb", "#16a34a", "#f97316", "#7c3aed"];
    compareVelocities.forEach((velocity, index) => {
      drawProjectileTrajectory(startX, startY, velocity, duration, baseY, width, colors[index % colors.length], index === 0 ? [] : [8, 7]);
      ctx.fillStyle = colors[index % colors.length];
      ctx.font = "700 13px Microsoft YaHei, sans-serif";
      ctx.fillText(`v0=${velocity}`, startX + 110, startY + 24 + index * 22);
    });
  } else if (state.projectile.showTrajectory || state.animation.mode === "projectile") {
    drawProjectileTrajectory(startX, startY, v0, duration, baseY, width, "#2563eb", [8, 8]);
  }

  drawBall(ball.x, Math.min(ball.y, baseY - 12), "#ef7d35");
  label(startX - 54, startY - 12, `h = ${state.projectile.height}`);
  label(startX + 8, baseY + 28, `v0 = ${v0}`);
  if (state.projectile.showVelocity) {
    arrow(startX + 12, startY - 24, startX + 115, startY - 24, "#2563eb", "v0");
  }
  if (state.projectile.showGravity) {
    arrow(ball.x + 26, ball.y - 14, ball.x + 26, ball.y + 62, "#d64545", "g");
  }
  ctx.restore();
}

function drawProjectileTrajectory(startX, startY, velocity, duration, baseY, width, color, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let t = 0; t <= duration; t += 0.05) {
    const point = getProjectilePosition(t, startX, startY, velocity);
    if (point.x > width - 40 || point.y > baseY) break;
    if (t === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.restore();
}

function getProjectilePosition(t, x0, y0, v0) {
  const g = 9.8;
  const scale = 38;
  return {
    x: x0 + v0 * scale * t,
    y: y0 + 0.5 * g * scale * t * t,
  };
}

function drawCircular(width, height) {
  const cx = width * 0.42;
  const cy = height * 0.48;
  const radius = Math.min(width, height) * 0.2;
  const releaseDeg = state.circular.releaseAngle;
  const releaseRad = (releaseDeg * Math.PI) / 180;
  const circleDuration = 2.2;
  const elapsed = state.animation.mode === "circular" ? state.animation.elapsed / 1000 : 0;
  const beforeRelease = elapsed < circleDuration;
  const currentRad = beforeRelease
    ? -Math.PI / 2 + (releaseRad + Math.PI / 2) * Math.min(elapsed / circleDuration, 1)
    : releaseRad;
  const release = {
    x: cx + radius * Math.cos(releaseRad),
    y: cy - radius * Math.sin(releaseRad),
  };
  let ball = {
    x: cx + radius * Math.cos(currentRad),
    y: cy - radius * Math.sin(currentRad),
  };

  if (!beforeRelease) {
    const t = Math.min(elapsed - circleDuration, 3.2);
    const speed = 165;
    const vx = speed * Math.sin(releaseRad);
    const vy = -speed * Math.cos(releaseRad);
    ball = {
      x: release.x + vx * t,
      y: release.y + vy * t + 160 * t * t,
    };
  }

  ctx.save();
  ctx.strokeStyle = "#394957";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#d9e0e7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 16, 0, Math.PI * 2);
  ctx.stroke();

  if (state.circular.showTrail || state.animation.mode === "circular") {
    ctx.strokeStyle = "#6d4cc2";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, releaseRad, false);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (state.circular.showTrail) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(release.x, release.y);
    for (let t = 0; t <= 2.8; t += 0.08) {
      const speed = 165;
      const vx = speed * Math.sin(releaseRad);
      const vy = -speed * Math.cos(releaseRad);
      const x = release.x + vx * t;
      const y = release.y + vy * t + 160 * t * t;
      ctx.lineTo(x, y);
      if (x > width - 32 || y > height - 50) break;
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawBall(ball.x, ball.y, "#ef7d35");
  drawBall(release.x, release.y, "#2563eb", 6);
  label(release.x + 12, release.y - 12, `${releaseDeg}° 脱离`);
  if (state.circular.showVelocity) {
    const vx = 82 * Math.sin(releaseRad);
    const vy = -82 * Math.cos(releaseRad);
    arrow(release.x, release.y, release.x + vx, release.y + vy, "#2563eb", "v");
  }
  if (state.circular.showGravity) {
    arrow(ball.x + 26, ball.y - 12, ball.x + 26, ball.y + 64, "#d64545", "g");
  }
  ctx.restore();
}

function drawInclined(width, height) {
  const x1 = width * 0.22;
  const y1 = height * 0.72;
  const x2 = width * 0.73;
  const y2 = height * 0.36;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const blockCenter = {
    x: x1 + (x2 - x1) * 0.52,
    y: y1 + (y2 - y1) * 0.52,
  };

  ctx.save();
  ctx.fillStyle = "#e5edf6";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, y1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#394957";
  ctx.lineWidth = 5;
  line(x1, y1, x2, y2);
  line(x1 - 18, y1, x2 + 28, y1);
  label(x2 - 64, y2 + 30, "斜面");

  if (state.inclined.block) {
    drawRotatedBlock(blockCenter.x, blockCenter.y, angle);
  }

  if (state.inclined.forces.gravity) {
    arrow(blockCenter.x, blockCenter.y, blockCenter.x, blockCenter.y + 118, "#d64545", "G");
  }
  if (state.inclined.forces.normal) {
    const nx = Math.sin(-angle);
    const ny = -Math.cos(angle);
    arrow(blockCenter.x, blockCenter.y, blockCenter.x + nx * 110, blockCenter.y + ny * 110, "#13956f", "N");
  }
  if (state.inclined.forces.friction) {
    const tx = Math.cos(angle);
    const ty = Math.sin(angle);
    arrow(blockCenter.x, blockCenter.y, blockCenter.x - tx * 118, blockCenter.y - ty * 118, "#b26b00", "f");
  }
  ctx.restore();
}

function drawHorizontal(width, height) {
  const groundY = height * 0.66;
  const blockX = width * 0.42;
  const blockY = groundY - 42;
  const mass = state.horizontal.mass;
  const force = state.horizontal.force;
  const acceleration = mass !== null && force !== null && mass > 0 ? Number((force / mass).toFixed(2)) : null;

  ctx.save();
  ctx.strokeStyle = "#394957";
  ctx.lineWidth = 5;
  line(width * 0.12, groundY, width * 0.86, groundY);
  ctx.strokeStyle = "#c7d2df";
  ctx.lineWidth = 1.5;
  for (let x = width * 0.12; x < width * 0.86; x += 28) {
    line(x, groundY + 18, x + 18, groundY);
  }
  label(width * 0.13, groundY + 44, "光滑水平面");

  if (state.horizontal.block) {
    ctx.fillStyle = "#f2b36d";
    ctx.strokeStyle = "#8a4c13";
    ctx.lineWidth = 2;
    ctx.fillRect(blockX - 54, blockY - 36, 108, 72);
    ctx.strokeRect(blockX - 54, blockY - 36, 108, 72);
    label(blockX - 38, blockY + 6, mass === null ? "物块" : `m = ${mass}kg`);
  }

  if (state.horizontal.showGravity) {
    arrow(blockX, blockY + 30, blockX, blockY + 132, "#d64545", "G");
  }
  if (state.horizontal.showNormal) {
    arrow(blockX, blockY - 30, blockX, blockY - 132, "#13956f", "N");
  }
  if (state.horizontal.showAppliedForce) {
    arrow(blockX + 58, blockY, blockX + 198, blockY, "#2563eb", force === null ? "F" : `F=${force}N`);
  }
  if (state.horizontal.showAcceleration && acceleration !== null) {
    arrow(blockX + 58, blockY + 54, blockX + 178, blockY + 54, "#6d4cc2", `a=${acceleration}m/s²`);
  }

  ctx.fillStyle = "#17202a";
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  const headline =
    acceleration === null ? "水平面受力分析：G、N、F" : `牛顿第二定律：a = F / m = ${force} / ${mass} = ${acceleration} m/s²`;
  ctx.fillText(headline, width * 0.14, height * 0.22);
  ctx.fillStyle = "#667085";
  ctx.font = "14px Microsoft YaHei, sans-serif";
  ctx.fillText("竖直方向重力 G 与支持力 N 平衡；水平方向存在向右拉力 F。若水平面粗糙，还需判断摩擦力。", width * 0.14, height * 0.22 + 28);
  ctx.restore();
}

function fitDiagramElements(elements, width, height) {
  const nodes = getDiagramNodes(elements);
  if (nodes.length === 0) return elements;

  const margin = 56;
  const nodeWidth = 156;
  const nodeHeight = 64;
  const gapX = 56;
  const gapY = 86;
  const maxColumns = Math.max(1, Math.floor((width - margin * 2 + gapX) / (nodeWidth + gapX)));
  const columns = Math.max(1, Math.min(nodes.length, maxColumns));
  const rows = Math.ceil(nodes.length / columns);
  const totalHeight = rows * nodeHeight + (rows - 1) * gapY;
  const startY = Math.max(150, (height - totalHeight) / 2 + 24);
  const layout = new Map();

  nodes.forEach((node, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const itemsInRow = row === rows - 1 ? nodes.length - row * columns : columns;
    const rowWidth = itemsInRow * nodeWidth + (itemsInRow - 1) * gapX;
    const rowStartX = Math.max(margin, (width - rowWidth) / 2);
    const x = rowStartX + col * (nodeWidth + gapX);
    const y = startY + row * (nodeHeight + gapY);
    layout.set(node, { x, y, width: nodeWidth, height: nodeHeight });
  });

  return elements.map((element) => {
    if (element.type === "draw_rect") {
      const box = layout.get(element);
      return {
        ...element,
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }
    if (element.type === "draw_circle") {
      const box = layout.get(element);
      const radius = Math.min(42, box.height / 2);
      return {
        ...element,
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        radius,
      };
    }
    return element;
  });
}

function drawDiagram(width, height) {
  const elements = fitDiagramElements(state.diagram.elements, width, height);
  const nodes = new Map();
  for (const element of elements) {
    if (element.type === "draw_rect") {
      nodes.set(element.id, {
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      });
    }
    if (element.type === "draw_circle") {
      nodes.set(element.id, {
        x: element.x - element.radius,
        y: element.y - element.radius,
        width: element.radius * 2,
        height: element.radius * 2,
      });
    }
  }

  ctx.save();
  for (const element of elements.filter((item) => item.type === "draw_line")) {
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    line(element.x1, element.y1, element.x2, element.y2);
    if (element.text) {
      ctx.fillStyle = "#111827";
      ctx.font = "700 12px Microsoft YaHei, sans-serif";
      ctx.fillText(element.text, (element.x1 + element.x2) / 2 + 8, (element.y1 + element.y2) / 2 - 8);
    }
  }
  for (const element of elements.filter((item) => item.type === "draw_arrow")) {
    const from = nodes.get(element.from);
    const to = nodes.get(element.to);
    const start = from ? { x: from.x + from.width, y: from.y + from.height / 2 } : { x: element.x1 ?? width * 0.2, y: element.y1 ?? height * 0.5 };
    const end = to ? { x: to.x, y: to.y + to.height / 2 } : { x: element.x2 ?? width * 0.8, y: element.y2 ?? height * 0.5 };
    diagramArrow(start.x, start.y, end.x, end.y, element.text || "");
  }

  for (const element of elements) {
    if (element.type === "draw_rect") {
      drawDiagramRect(element);
    } else if (element.type === "draw_circle") {
      drawDiagramCircle(element);
    } else if (element.type === "draw_text") {
      ctx.fillStyle = element.color;
      ctx.font = `700 ${element.size}px Microsoft YaHei, sans-serif`;
      ctx.fillText(element.text, element.x, element.y);
    }
  }
  ctx.restore();
}

function drawDiagramRect(element) {
  ctx.save();
  const radius = 10;
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = element.color || "#ffffff";
  roundedRect(element.x, element.y, element.width, element.height, radius);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.8;
  roundedRect(element.x, element.y, element.width, element.height, radius);
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapText(element.text, element.x + element.width / 2, element.y + element.height / 2, element.width - 24, 19);
  ctx.restore();
}

function drawDiagramCircle(element) {
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = element.color || "#ffffff";
  ctx.beginPath();
  ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#111827";
  ctx.font = "700 16px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  wrapText(element.text, element.x, element.y, element.radius * 1.55, 19);
  ctx.restore();
}

function diagramArrow(x1, y1, x2, y2, text) {
  arrow(x1, y1, x2, y2, "#334155", "");
  const labelText = String(text || "").trim();
  if (!labelText || labelText.length > 6) return;

  const x = (x1 + x2) / 2;
  const y = (y1 + y2) / 2 - 10;
  ctx.save();
  ctx.font = "700 12px Microsoft YaHei, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = ctx.measureText(labelText).width + 12;
  ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
  roundedRect(x - width / 2, y - 11, width, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.fillText(labelText, x, y);
  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapText(text, x, y, maxWidth, lineHeight) {
  const chars = String(text).split("");
  const lines = [];
  let line = "";
  chars.forEach((char) => {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  });
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((item, index) => ctx.fillText(item, x, startY + index * lineHeight));
}

function drawRotatedBlock(x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = "#f2b36d";
  ctx.strokeStyle = "#8a4c13";
  ctx.lineWidth = 2;
  ctx.fillRect(-42, -30, 84, 60);
  ctx.strokeRect(-42, -30, 84, 60);
  ctx.restore();
}

function drawBall(x, y, color, radius = 14) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = "#762d11";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function label(x, y, text) {
  ctx.save();
  ctx.fillStyle = "#17202a";
  ctx.font = "700 14px Microsoft YaHei, sans-serif";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function arrow(x1, y1, x2, y2, color, text) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  line(x1, y1, x2, y2);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 13 * Math.cos(angle - Math.PI / 6), y2 - 13 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - 13 * Math.cos(angle + Math.PI / 6), y2 - 13 * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 15px Microsoft YaHei, sans-serif";
  ctx.fillText(text, x2 + 8, y2 + 5);
  ctx.restore();
}

function line(x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function tick(now) {
  if (state.animation.running) {
    state.animation.elapsed = now - state.animation.startMs;
    const maxMs = state.animation.mode === "circular" ? 5600 : 3600;
    if (state.animation.elapsed > maxMs) {
      state.animation.running = false;
      state.animation.elapsed = maxMs;
    }
    render();
  }
  rafId = requestAnimationFrame(tick);
}

ui.micButton.addEventListener("click", () => {
  if (wantsListening) {
    stopListeningByVoice();
  } else {
    startListening();
  }
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    const command = button.getAttribute("data-command");
    if (command) {
      handleTranscript(command);
    }
  });
});

ui.analyzeProblemButton.addEventListener("click", () => {
  analyzeProblem();
});

ui.drawProblemButton.addEventListener("click", () => {
  drawProblemPlan();
});

window.addEventListener("resize", resizeCanvas);
setupSpeech();
resizeCanvas();
updateParams();
updateStats();
render();
rafId = requestAnimationFrame(tick);
addLog("应用已就绪");
window.setTimeout(() => {
  if (!wantsListening && recognition) {
    addLog("正在自动尝试启动语音监听");
    startListening();
  }
}, 600);

window.__EDUSKETCH_TEST__ = {
  parseCommand,
  handleTranscript,
  localAnalyzeProblem,
  validateActions,
  fitDiagramElements,
  isListeningWanted: () => wantsListening,
  getState: () => cloneState(state),
};
