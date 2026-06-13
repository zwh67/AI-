import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const port = Number(process.env.PORT || 5173);
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
]);
const allowedForces = new Set(["gravity", "normal", "friction"]);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function chineseNumberToDigit(text) {
  const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text);
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [tens, ones] = text.split("十");
    return (tens ? map[tens] ?? 1 : 1) * 10 + (ones ? map[ones] ?? 0 : 0);
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

function normalizeText(text) {
  return String(text || "")
    .replace(/[，。！？、；：,.!?;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  return words.some((word) => text.includes(word));
}

export function validateActions(actions) {
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
      return { type: action.type };
    })
    .filter(Boolean);
}

export function normalizeProblemAnalysis(raw, source = "local-demo") {
  const analysis = raw && typeof raw === "object" ? raw : {};
  const sceneType = ["projectile", "circular_release", "inclined_plane", "horizontal_force", "unknown"].includes(analysis.sceneType)
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
  };
}

export function localAnalyzeProblem(problemText) {
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
  });
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
      reply: "我会绘制一个基础圆形。",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_circle", id: "circle", text: label, x: 520, y: 350, radius: 82, color: "#ffffff" },
      ],
      source: "local-basic-shape",
    };
  }
  if (includesAny(normalized, ["矩形", "长方形", "方框", "框形", "一个框", "画框"])) {
    return {
      reply: "我会绘制一个基础矩形。",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_rect", id: "rect", text: label, x: 430, y: 300, width: 220, height: 110, color: "#ffffff" },
      ],
      source: "local-basic-shape",
    };
  }
  if (includesAny(normalized, ["箭头", "连线"])) {
    return {
      reply: "我会绘制一个箭头。",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_arrow", x1: 380, y1: 350, x2: 680, y2: 350, text: label },
      ],
      source: "local-basic-shape",
    };
  }
  if (includesAny(normalized, ["写文字", "添加文字", "输入文字", "写上", "标注"])) {
    return {
      reply: "我会添加文字。",
      actions: [
        { type: "clear_canvas" },
        { type: "draw_text", text: label || normalized.replace(/(写文字|添加文字|输入文字|写上|标注)/g, "").trim() || "文字", x: 420, y: 350, size: 28, color: "#111827" },
      ],
      source: "local-basic-shape",
    };
  }
  return null;
}

function localPlanGenericDiagram(text) {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["画一个系统", "一个系统", "系统图"]) && !includesAny(normalized, ["登录", "推荐", "前后端", "数据", "购物", "AI"])) {
    return {
      reply: "你想画哪类系统？例如登录系统、推荐系统、前后端系统，还是数据处理系统？",
      actions: [{ type: "ask_clarification", message: "你想画哪类系统？例如登录系统、推荐系统、前后端系统，还是数据处理系统？" }],
      source: "local-clarification",
    };
  }
  if (includesAny(normalized, ["在线购物", "购物流程", "下单流程", "电商流程"])) {
    return {
      reply: "我会生成在线购物流程图。",
      actions: makeFlowActions("在线购物流程", [
        { id: "browse", text: "选择商品" },
        { id: "cart", text: "加入购物车" },
        { id: "pay", text: "支付订单" },
        { id: "ship", text: "商家发货" },
        { id: "receive", text: "确认收货" },
      ], { startX: 80, y: 320, gap: 155 }),
      source: "local-generalized",
    };
  }
  if (includesAny(normalized, ["用户请求", "数据库返回", "返回结果", "请求到数据库"])) {
    return {
      reply: "我会生成从用户请求到数据库返回结果的流程。",
      actions: makeFlowActions("请求响应流程", [
        { id: "request", text: "用户请求" },
        { id: "frontend", text: "前端接收" },
        { id: "backend", text: "后端处理" },
        { id: "database", text: "查询数据库" },
        { id: "response", text: "返回结果" },
      ], { startX: 80, y: 320, gap: 155 }),
      source: "local-generalized",
    };
  }
  return null;
}

function localPlanDrawing(text) {
  const normalized = normalizeText(text);
  if (includesAny(normalized, ["登录流程", "登陆流程", "登录流程图", "登陆流程图", "登录系统", "登陆系统", "登录过程", "登陆过程", "账号密码到登录成功"])) {
    return {
      reply: "我会把登录流程扩展成开始、输入、校验、成功和失败分支。",
      actions: makeFlowActions("登录流程图", [
        { id: "start", text: "开始", shape: "circle", color: "#dff5ec" },
        { id: "input", text: "输入账号密码" },
        { id: "validate", text: "校验信息" },
        { id: "success", text: "登录成功", y: 250, color: "#dff5ec", arrowText: "通过" },
        { id: "fail", text: "登录失败", y: 390, color: "#ffe2e2", arrowText: "失败" },
      ], { startX: 100, y: 320, gap: 160 }),
      source: "local-template",
    };
  }
  if (includesAny(normalized, ["前后端架构", "前后端框架", "前端后端", "前后端", "浏览器服务器", "浏览器 服务端", "架构图"])) {
    return {
      reply: "我会生成用户、前端、后端服务和数据库组成的架构图。",
      actions: makeFlowActions("前后端架构图", [
        { id: "user", text: "用户", shape: "circle", color: "#dff5ec" },
        { id: "frontend", text: "前端页面" },
        { id: "api", text: "后端 API" },
        { id: "service", text: "业务服务" },
        { id: "db", text: "数据库", color: "#fff0ce" },
      ], { startX: 90, y: 320, gap: 150 }),
      source: "local-template",
    };
  }
  if (includesAny(normalized, ["AI项目", "AI 项目", "AI应用", "AI 应用", "开发流程", "学习路线"])) {
    return {
      reply: "我会生成 AI 应用开发流程图。",
      actions: makeFlowActions("AI 应用开发流程图", [
        { id: "need", text: "需求输入", color: "#eef3ff" },
        { id: "data", text: "数据处理" },
        { id: "model", text: "模型调用", color: "#f2eafd" },
        { id: "parse", text: "结果解析" },
        { id: "guard", text: "异常处理", color: "#fff0ce" },
        { id: "monitor", text: "日志监控", color: "#dff5ec" },
      ], { startX: 58, y: 320, gap: 145 }),
      source: "local-template",
    };
  }
  return localPlanBasicShape(normalized) || localPlanGenericDiagram(normalized);
}

function buildAnalyzePrompt(problemText) {
  return `你是高中物理讲题助手。请只分析高中力学题，并返回严格 JSON，不要 Markdown。
只支持 sceneType: projectile, circular_release, inclined_plane, horizontal_force, unknown。
actions 只能使用白名单动作，不能编造字段。
如果题目超出范围，sceneType 返回 unknown，actions 返回空数组。

JSON schema:
{
  "sceneType": "projectile | circular_release | inclined_plane | horizontal_force | unknown",
  "knowledgePoints": ["string"],
  "knowns": [{"name": "string", "symbol": "string", "value": 0, "unit": "string"}],
  "goals": ["string"],
  "steps": ["string"],
  "visualPlan": "string",
  "actions": [{"type": "draw_projectile"}],
  "limitations": ["string"]
}

动作白名单:
draw_projectile, set_projectile_velocity, set_projectile_height, draw_circular_track, add_ball, set_release_angle, draw_inclined_plane, draw_horizontal_surface, add_block, set_mass, set_force, show_force, show_applied_force, show_acceleration, show_velocity, show_gravity, start_simulation, pause_simulation, replay_simulation, clear_canvas, undo, export_image。
show_force.force 只能是 gravity, normal, friction。

题目:
${problemText}`;
}

async function callOpenAIJson(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const payload = {
    model,
    messages: [
      { role: "system", content: "你只输出严格 JSON。" },
      { role: "user", content: prompt },
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
  };
  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const request = (body) => fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let response = await request(payload);
  if (!response.ok && response.status === 400) {
    const retryPayload = { ...payload };
    delete retryPayload.response_format;
    response = await request(retryPayload);
  }
  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned empty content");
  try {
    const parsed = JSON.parse(extractJson(content));
    if (process.env.EDUSKETCH_DEBUG_LLM === "1") {
      console.log("[llm raw]", content);
      console.log("[llm parsed]", JSON.stringify(parsed));
    }
    return parsed;
  } catch (error) {
    const message = `LLM returned invalid JSON: ${error.message}. Raw: ${String(content).slice(0, 500)}`;
    throw new Error(message);
  }
}

function extractJson(content) {
  const text = String(content).trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return text.slice(start, end + 1);
  }
  return text;
}

async function analyzeProblem(problemText) {
  const llmResult = await callOpenAIJson(buildAnalyzePrompt(problemText));
  if (llmResult) {
    const normalized = normalizeProblemAnalysis(llmResult, "llm");
    const local = localAnalyzeProblem(problemText);
    if ((normalized.sceneType === "unknown" || normalized.actions.length === 0) && local.sceneType !== "unknown") {
      return { ...local, source: "llm-fallback-local", limitations: ["LLM 未返回可执行图示，已使用本地题型识别补全。", ...local.limitations] };
    }
    return normalized;
  }
  return localAnalyzeProblem(problemText);
}

function parseContextCommand(text, problemContext) {
  const normalized = normalizeText(text);
  const template = localPlanDrawing(normalized);
  if (template) return { ...template, actions: validateActions(template.actions) };
  const context = normalizeProblemAnalysis(problemContext || {}, "context");
  const forceActions = buildForceAnalysisActions(context);
  if (includesAny(normalized, ["受力分析", "受力图", "受力绘图", "标出所有力", "分析受力", "画出所有力"])) {
    return { reply: "我将根据当前题目逐步绘制受力分析图。", actions: forceActions, source: "context" };
  }
  if (includesAny(normalized, ["画图", "示意图", "根据题目画图"])) {
    return { reply: "我将根据题目分析生成推荐图示。", actions: context.actions, source: "context" };
  }
  if (includesAny(normalized, ["知识点"])) {
    return { reply: `这道题涉及：${context.knowledgePoints.join("、") || "暂无知识点分析"}`, actions: [], source: "context" };
  }
  const stepMatch = normalized.match(/第([一二三四五六七八九十\d]+)步/);
  if (stepMatch) {
    const index = Math.max(0, extractNumber(stepMatch[1], 1) - 1);
    return { reply: context.steps[index] || "当前没有这一步的分析。", actions: [], source: "context" };
  }
  if (includesAny(normalized, ["下一步"])) {
    return { reply: context.steps[1] || context.steps[0] || "当前没有步骤分析。", actions: [], source: "context" };
  }
  return { reply: "当前版本支持一句话生成流程图、架构图、AI 开发流程图和教学示意图。", actions: [], source: "context" };
}

function buildForceAnalysisActions(context) {
  if (context.sceneType === "horizontal_force") {
    const actions = [{ type: "draw_horizontal_surface" }, { type: "add_block" }];
    const mass = context.knowns.find((item) => item.symbol === "m")?.value;
    const force = context.knowns.find((item) => item.symbol === "F")?.value;
    if (Number.isFinite(Number(mass))) actions.push({ type: "set_mass", value: Number(mass) });
    if (Number.isFinite(Number(force))) actions.push({ type: "set_force", value: Number(force) });
    actions.push({ type: "show_force", force: "gravity" }, { type: "show_force", force: "normal" }, { type: "show_applied_force" });
    if (Number.isFinite(Number(mass)) && Number.isFinite(Number(force))) actions.push({ type: "show_acceleration" });
    return actions;
  }
  if (context.sceneType === "inclined_plane") {
    return [
      { type: "draw_inclined_plane" },
      { type: "add_block" },
      { type: "show_force", force: "gravity" },
      { type: "show_force", force: "normal" },
      { type: "show_force", force: "friction" },
    ];
  }
  if (context.sceneType === "projectile" || context.sceneType === "circular_release") {
    return [{ type: "show_velocity" }, { type: "show_gravity" }, { type: "show_trajectory" }];
  }
  return [];
}

function buildCommandPrompt(text, problemContext) {
  const currentDiagram = problemContext?.currentDiagram;
  return `你是 VoiceCanvas Lite 的图示规划器。
用户会用中文语音描述想画的内容。你的任务是把用户意图扩展成一个清晰、简洁的图示方案，并输出严格 JSON actions。
你不能生成图片，不能生成 Canvas 代码，不能输出 Markdown，只能输出 JSON。

只能返回:
{
  "reply": "给用户的简短中文回应",
  "actions": []
}
actions 只能使用动作白名单。只要用户给出了明确主题，例如“员工入职流程图”“请假审批流程”“供应链流程”，就必须生成可执行 actions，不要返回空数组。
如果用户意图真的太模糊，例如“画一个系统”，才返回 ask_clarification。

你可以生成以下类型的图:
1. 流程图
2. 架构图
3. 关系图
4. 教学示意图
5. 简单物理图示

动作白名单:
draw_box, draw_rect, draw_circle, draw_arrow, draw_line, draw_text, draw_template, ask_clarification,
draw_projectile, set_projectile_velocity, set_projectile_height, draw_circular_track, add_ball, set_release_angle, draw_inclined_plane, draw_horizontal_surface, add_block, set_mass, set_force, show_force, show_applied_force, show_acceleration, show_velocity, show_gravity, show_trajectory, start_simulation, pause_simulation, replay_simulation, clear_canvas, undo, export_image。
show_force.force 只能是 gravity, normal, friction。

通用图示优先使用 draw_box/draw_circle/draw_arrow/draw_line/draw_text。
严禁把节点文字写成“节点”“步骤”“模块”“组件”这类占位词；每个节点必须是具体业务含义，例如“前端页面”“后端 API”“数据库”“校验信息”。
流程类指令必须生成 3 到 6 个具体节点和箭头。流程图 actions 必须包含 clear_canvas、一个 draw_text 标题、多个 draw_rect/draw_circle 节点，以及 draw_arrow 连接。
如果用户说“包括 A B C D”或列出若干环节，请把这些环节作为流程节点，不要丢弃。
架构类指令生成模块节点和连接箭头。
关系类指令生成实体节点和关系箭头/线条。
物理运动、平抛、斜面、圆周运动优先使用 draw_template 或已有物理动作。
节点坐标应落在 80..820 x 120..520 范围内。前端会重新排版，坐标只需合理。
新图可以包含 clear_canvas；如果题目上下文里已有图示，优先追加或修改现有图示。
如果当前图示已有节点，且用户说“扩展、扩容、复杂一点、丰富、细化、完善”，这是扩展当前图，不是生成新图：
- 禁止返回 clear_canvas。
- 禁止重复已有节点。
- 必须基于已有节点语义补充真实业务环节。
- 如果没有足够信息判断该补什么，返回 ask_clarification，不要添加“新步骤”“一点”“更多节点”等占位节点。

当前图示摘要:
${currentDiagram?.nodes?.length ? currentDiagram.nodes.map((node, index) => `${index + 1}. ${node.text}(${node.id})`).join("\n") : "无"}

示例:
用户说“画一个在线购物流程”，返回选择商品、加入购物车、支付订单、商家发货、确认收货等节点。
用户说“画一个员工入职流程图，包括提交资料、主管审批、签合同、开通账号”，返回提交资料、主管审批、签署合同、开通账号等节点和箭头。
用户在吃饭流程图上说“复杂一点”，可以补充“清洗食材”“调味”“收拾餐具”等真实环节，但不能返回“一点”“新步骤”。
用户说“帮我画一个系统”，返回 ask_clarification，询问是哪类系统。

题目上下文:
${JSON.stringify(problemContext || {})}

用户语音:
${text}`;
}

function pickText(value) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  for (const key of ["text", "label", "name", "title", "step", "content", "description"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return "";
}

function collectNodeTexts(value) {
  if (!Array.isArray(value)) return [];
  return value.map(pickText).filter(Boolean);
}

function collectNestedNodeTexts(result) {
  const containers = [
    result?.nodes,
    result?.steps,
    result?.flow,
    result?.process,
    result?.items,
    result?.stages,
    result?.actions,
    result?.data?.nodes,
    result?.data?.steps,
    result?.graph?.nodes,
    result?.diagram?.nodes,
    result?.flowchart?.nodes,
    result?.plan?.nodes,
    result?.plan?.steps,
  ];
  for (const container of containers) {
    const texts = collectNodeTexts(container);
    if (texts.length >= 2) return texts;
  }
  return [];
}

function extractMermaidNodeTexts(value) {
  const text = typeof value === "string" ? value : "";
  const labels = [];
  const seen = new Set();
  const pattern = /[A-Za-z0-9_]+\s*(?:\[([^\]]+)\]|\(([^)]+)\)|\{([^}]+)\})/g;
  for (const match of text.matchAll(pattern)) {
    const label = (match[1] || match[2] || match[3] || "").replace(/^["']|["']$/g, "").trim();
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return labels;
}

function collectTextFields(value, depth = 0, output = []) {
  if (depth > 4 || value === null || value === undefined) return output;
  if (typeof value === "string") {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextFields(item, depth + 1, output));
    return output;
  }
  if (typeof value === "object") {
    for (const key of ["mermaid", "diagram", "content", "text", "markdown", "flowchart"]) {
      if (typeof value[key] === "string") output.push(value[key]);
    }
    for (const item of Object.values(value)) {
      collectTextFields(item, depth + 1, output);
    }
  }
  return output;
}

function inferDiagramTitle(text, result) {
  const title = pickText({ text: result?.title || result?.name || result?.summary || result?.reply });
  if (title) return title.slice(0, 24);
  const normalized = normalizeText(text).replace(/^(帮我|请|麻烦)?(画|生成|做)(一个|一张)?/, "").trim();
  return (normalized || "流程图").slice(0, 24);
}

function makeFlowActionsFromTexts(title, texts) {
  const nodes = texts.slice(0, 6).map((text, index) => ({
    id: `llm_node_${index}`,
    text,
  }));
  return makeFlowActions(title, nodes, { startX: 80, y: 320, gap: nodes.length > 5 ? 145 : 155 });
}

function isDiagramExtensionRequest(text, problemContext) {
  const normalized = normalizeText(text);
  return Boolean(problemContext?.currentDiagram?.nodes?.length) && includesAny(normalized, ["扩展", "扩容", "追加", "添加", "增加", "补充", "继续", "再加", "复杂", "复杂化", "细化", "完善", "丰富", "展开"]);
}

function normalizeNodeText(text) {
  return normalizeText(text).replace(/\s+/g, "").toLowerCase();
}

function lastCurrentDiagramNode(problemContext) {
  const nodes = Array.isArray(problemContext?.currentDiagram?.nodes) ? problemContext.currentDiagram.nodes : [];
  if (nodes.length === 0) return null;
  return nodes
    .map((node) => ({
      ...node,
      right: Number(node.x || 0) + Number(node.width || node.radius || 0),
    }))
    .sort((a, b) => a.right - b.right)
    .at(-1);
}

function sanitizeExtensionActions(actions, text, problemContext) {
  if (!isDiagramExtensionRequest(text, problemContext)) return actions;
  const currentNodes = Array.isArray(problemContext.currentDiagram.nodes) ? problemContext.currentDiagram.nodes : [];
  const existingTexts = new Set(currentNodes.map((node) => normalizeNodeText(node.text)));
  const vagueTexts = new Set(["一点", "一下", "一些", "新步骤", "新节点", "更多步骤", "更多节点", "步骤", "节点"]);
  const candidateNodes = validateActions(actions)
    .filter((action) => action.type === "draw_rect" || action.type === "draw_circle")
    .filter((action) => {
      const normalized = normalizeNodeText(action.text);
      return normalized && !existingTexts.has(normalized) && !vagueTexts.has(action.text);
    });

  if (candidateNodes.length === 0) {
    return [{ type: "ask_clarification", message: "你想往当前图里补充哪些具体环节？例如清洗食材、调味、收拾餐具。" }];
  }

  const lastNode = lastCurrentDiagramNode(problemContext);
  let previousId = lastNode?.id || currentNodes.at(-1)?.id || "";
  const baseX = Number(lastNode?.x || 120) + Number(lastNode?.width || 150) + 74;
  const baseY = Number(lastNode?.y || 320);
  const extensionActions = [];
  candidateNodes.slice(0, 3).forEach((node, index) => {
    const id = node.id && !currentNodes.some((current) => current.id === node.id) ? node.id : `extend_${Date.now()}_${index}`;
    const safeNode = {
      ...node,
      id,
      x: baseX + index * 170,
      y: baseY,
      width: node.width || 150,
      height: node.height || 64,
      color: node.color || "#eef3ff",
    };
    extensionActions.push(safeNode);
    if (previousId) extensionActions.push({ type: "draw_arrow", from: previousId, to: id, text: "" });
    previousId = id;
  });
  return extensionActions;
}

function splitProcessText(text) {
  const normalized = normalizeText(text)
    .replace(/^(帮我|请|麻烦)?(画|生成|做|设计)(一个|一张)?/, "")
    .replace(/(流程图|流程|图示|图)$/g, "")
    .trim();
  const afterIncludes = normalized.split(/(?:包括|包含|含有|需要|依次是|步骤是|节点是)/).pop() || normalized;
  const directParts = afterIncludes
    .split(/(?:、|，|,|；|;|->|→|=>|然后|再|接着|最后|以及|和)/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 14);
  if (directParts.length >= 2) return directParts;

  const compact = afterIncludes.replace(/\s+/g, "");
  const verbStarts = /(?=提交|填写|上传|收集|主管|经理|HR|人事|财务|审核|审批|确认|签署|签订|签|开通|创建|分配|通知|培训|归档|支付|发货|收货|注册|登录|校验|查询|返回|生成|发布|部署|测试)/g;
  const inferredParts = compact
    .split(verbStarts)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 14);
  return inferredParts.length >= 2 ? inferredParts : [];
}

function genericPlanFromText(text, result = {}) {
  const normalized = normalizeText(text);
  const wantsDiagram = includesAny(normalized, ["流程", "流程图", "架构", "关系图", "图示", "画", "生成", "设计"]);
  if (!wantsDiagram) return null;
  const nodeTexts = splitProcessText(normalized);
  if (nodeTexts.length >= 2) {
    return {
      reply: typeof result.reply === "string" ? result.reply : "我会根据你的描述生成流程图。",
      actions: makeFlowActionsFromTexts(inferDiagramTitle(text, result), nodeTexts),
      source: "text-compiled",
    };
  }
  return null;
}

function describeInvalidLlmResult(result) {
  if (!result || typeof result !== "object") return "LLM did not return a JSON object";
  if (Array.isArray(result.actions)) {
    const types = result.actions.map((action) => (action && typeof action === "object" ? action.type : typeof action)).filter(Boolean);
    if (types.length) return `LLM actions were not executable. Returned action types: ${types.join(", ")}`;
    return "LLM returned an empty actions array";
  }
  const keys = Object.keys(result);
  return `LLM returned no executable actions. Top-level keys: ${keys.join(", ") || "none"}`;
}

export function coerceLlmCommandResult(result, text, problemContext = null) {
  const reply = typeof result?.reply === "string" ? result.reply : "已生成图示规划。";
  const directActions = validateActions(result?.actions);
  if (directActions.length) {
    return { reply, actions: sanitizeExtensionActions(directActions, text, problemContext), source: "llm" };
  }
  if (Array.isArray(result?.actions) && result.actions.length > 0) {
    const textPlan = genericPlanFromText(text, result);
    if (textPlan) return { ...textPlan, actions: sanitizeExtensionActions(textPlan.actions, text, problemContext), source: "llm-repaired" };
  }

  const nestedTexts = collectNestedNodeTexts(result);
  if (nestedTexts.length >= 2) {
    const actions = makeFlowActionsFromTexts(inferDiagramTitle(text, result), nestedTexts);
    return {
      reply,
      actions: sanitizeExtensionActions(actions, text, problemContext),
      source: "llm-coerced",
    };
  }

  for (const candidate of collectTextFields(result)) {
    const texts = extractMermaidNodeTexts(candidate);
    if (texts.length >= 2) {
      const actions = makeFlowActionsFromTexts(inferDiagramTitle(text, result), texts);
      return {
        reply,
        actions: sanitizeExtensionActions(actions, text, problemContext),
        source: "llm-coerced",
      };
    }
  }

  const textPlan = genericPlanFromText(text, result);
  if (textPlan) return { ...textPlan, actions: sanitizeExtensionActions(textPlan.actions, text, problemContext), source: "llm-repaired" };

  return { reply, actions: [], source: "llm-empty", llmError: describeInvalidLlmResult(result) };
}

async function parseCommandWithLLM(text, problemContext) {
  const result = await callOpenAIJson(buildCommandPrompt(text, problemContext));
  if (!result) return null;
  const command = coerceLlmCommandResult(result, text, problemContext);
  if (command.actions.length === 0) {
    throw new Error(command.llmError || "LLM returned no executable drawing actions");
  }
  return command;
}

function aiDisabledResult() {
  return {
    reply: "AI 绘图未启用：后端没有配置 OPENAI_API_KEY。请先配置 API Key 并重启服务。",
    actions: [],
    source: "ai-disabled",
    llmError: "OPENAI_API_KEY is not configured",
  };
}

async function handleApi(req, res, pathname) {
  try {
    const body = await readJsonBody(req);
    if (pathname === "/api/analyze-problem") {
      const problemText = String(body.problemText || "").trim();
      if (!problemText) return json(res, 400, { error: "problemText is required" });
      return json(res, 200, await analyzeProblem(problemText));
    }
    if (pathname === "/api/parse-command") {
      const text = String(body.text || "");
      const hasApiKey = Boolean(process.env.OPENAI_API_KEY);
      const localTemplate = localPlanDrawing(text);
      if (!hasApiKey && localTemplate) {
        return json(res, 200, { ...localTemplate, actions: validateActions(localTemplate.actions) });
      }
      let result = null;
      let llmError = null;
      if (hasApiKey) {
        try {
          result = await parseCommandWithLLM(text, body.problemContext);
        } catch (error) {
          llmError = error;
          result = null;
        }
      }
      result ||= localTemplate;
      result ||= parseContextCommand(text, body.problemContext);
      if (!hasApiKey && validateActions(result.actions).length === 0) {
        result = aiDisabledResult();
      }
      return json(res, 200, {
        ...result,
        actions: validateActions(result.actions),
        llmError: llmError ? llmError.message : result.llmError,
      });
    }
    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = normalize(join(rootDir, safePath));
  if (!fullPath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(fullPath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(fullPath)] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

export function createAppServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "POST" && url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    if (req.method === "GET" || req.method === "HEAD") {
      await serveStatic(req, res, url.pathname);
      return;
    }
    res.writeHead(405);
    res.end("Method not allowed");
  });
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  createAppServer().listen(port, "127.0.0.1", () => {
    const mode = process.env.OPENAI_API_KEY ? "LLM enabled" : "local-demo fallback";
    console.log(`EduSketch Voice server running at http://127.0.0.1:${port}/ (${mode})`);
  });
}
