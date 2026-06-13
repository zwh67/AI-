# VoiceCanvas Lite

VoiceCanvas Lite 是一个纯语音控制的 AI 绘图白板。用户无需鼠标和键盘，只需说出一个简单、自然、甚至有点模糊的绘图意图，系统就会通过本地模板和大模型语义扩展，把语音转换成结构化绘图动作，并在 Canvas 上生成完整图示。

核心卖点：

```text
一句话语音 -> AI/模板扩展 -> 结构化 actions -> Canvas 自动绘图
```

它不是“说一句画一个圆”的命令画板，而是“一句话生成完整图示”的创作工具。

## 三层能力

| 层级 | 能力 | 示例 |
| --- | --- | --- |
| 基础语音绘图 | 直接执行明确指令 | 清空、撤回、导出、开始模拟 |
| 模板语音绘图 | 一句话生成固定模板 | 画一个登录流程图、画一个前后端架构图 |
| LLM 创意扩展 | 模糊意图扩展为图示动作 | 帮我画一个 AI 应用开发流程图 |

物理相关功能保留为“教学图示模板”，例如：

```text
画一个平抛运动讲解图
画一个斜面受力分析图
画圆周运动脱离轨迹
```

## 支持的图示

已实现：

- 登录流程图
- 前后端架构图
- AI 应用开发流程图
- 平抛运动讲解图
- 圆周运动脱离图
- 斜面受力分析图
- 水平面受力分析图

## LLM 的作用

大模型不直接生成图片，也不写 Canvas 代码。它只做三件事：

1. 理解用户语音意图。
2. 补全用户没有说清楚的图示细节。
3. 输出结构化绘图动作 actions。

后端 system prompt 会限制模型：

```text
只能输出 JSON
只能使用动作白名单
不能生成代码
不能调用不存在的功能
不能直接操作 Canvas
```

## 运行方式

推荐使用 Node 服务启动，这样 LLM 代理接口可用：

```powershell
cd D:\work\AI
npm.cmd run serve
```

打开：

```text
http://127.0.0.1:5173/
```

## 配置 API Key

API Key 只放在后端环境变量里，不写进前端：

```powershell
$env:OPENAI_API_KEY="你的 API Key"
$env:OPENAI_MODEL="deepseek-chat"
$env:OPENAI_BASE_URL="https://api.deepseek.com"
npm.cmd run serve
```

没有配置 Key 时，系统仍可使用本地模板生成登录流程图、架构图、AI 开发流程图和物理教学模板。

## 语音演示脚本

```text
画一个登录流程图
```

```text
画一个前后端架构图
```

```text
画一个 AI 应用开发流程图
```

```text
画一个平抛运动讲解图
开始模拟
```

```text
画一个斜面受力分析图
```

分阶段物理图示也支持：

```text
画斜面
添加物块
做受力分析
```

## 动作 DSL

通用绘图动作：

```text
draw_rect
draw_circle
draw_arrow
draw_text
```

教学模板动作：

```text
draw_projectile
draw_circular_track
draw_inclined_plane
draw_horizontal_surface
show_force
show_velocity
show_gravity
show_trajectory
start_simulation
```

控制动作：

```text
clear_canvas
undo
export_image
pause_simulation
replay_simulation
```

## 本地验证

```powershell
npm.cmd run check
npm.cmd test
```
