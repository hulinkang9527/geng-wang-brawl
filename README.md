# 梗王大乱斗 · MEME BRAWL

一个纯网页的 3D 卡通格斗游戏，打开链接就能玩，支持在线联机、单人街机、本地双人、招式训练。

- 无需安装、无需注册，手机/电脑浏览器直接打开
- 3D 角色和场景全部用代码程序化生成（无外部模型、无美术素材）
- 音效由 Web Audio 实时合成
- 在线联机基于 WebRTC（PeerJS），只交换房间号即可 P2P 对战，无需服务器

## 在线游玩

部署在 GitHub Pages：

**https://hulinkang9527.github.io/geng-wang-brawl/**

> 用 Chrome / Edge / Safari 最新版打开。手机请横屏游玩。

## 四种模式

| 模式 | 玩法 |
| --- | --- |
| 在线联机 | 创建房间得到 6 位房间号，发给好友，好友输入房间号加入，实时对战 |
| 单人街机 | 打 CPU，三局两胜 |
| 本地双人 | 两个人共用一块键盘互殴 |
| 招式训练 | 无限能量，练连招、练大必杀 |

## 角色

- **01 奶蛙 ·「笑不活了」**：灵活脆皮，连段最快，攒满能量爆气后开大「笑不活了 LAUGH RIOT」
- **02 肥嘟嘟 ·「准时达真骑士」**：血厚拳重，小必杀骑摩托冲撞，大必杀「胆量超载 GUTS OVERLOAD」
- **03 ???**：新角色憋大招中

## 战斗规则

- 每局 75 秒，三局两胜（ROUND 1 / 2 / 3）
- 三条资源：血条（橙）、护盾条（绿）、能量条（黄）
- **打中人才涨能量**；能量满 50 放小必杀，满 100 可爆气，爆气状态下再按一次开大
- 护盾按住即可格挡，在对方命中瞬间按下触发完美格挡
- 闪避有短暂无敌帧

## 键位

### P1（键盘左侧）

| 按键 | 动作 |
| --- | --- |
| A / D | 左右移动 |
| W | 跳 |
| J | 轻拳（可连段） |
| K | 重拳（按住蓄力，松开重击） |
| L | 护盾 / 格挡 |
| Shift | 闪避 |
| U | 小必杀 |
| I | 爆气 / 再按一次大必杀 |
| P / Esc | 暂停 |

### P2（本地双人，键盘右侧）

| 按键 | 动作 |
| --- | --- |
| ← / → | 移动 |
| ↑ | 跳 |
| 1 | 轻拳 |
| 2 | 重拳 |
| 3 | 护盾 |
| 右 Shift | 闪避 |
| 4 | 小必杀 |
| 5 | 爆气 / 大必杀 |

### 手机

横屏后左下角虚拟摇杆移动，右下角六个按钮（拳、重、盾、闪、必、爆）+ 跳。

### 训练模式快捷键

- `R`：重置双方站位
- `H`：切换假人行为（站立 / 防御 / 反击）

## 在线联机说明

1. 一人点「在线联机」→「创建房间」，得到 6 位房间号
2. 另一人点「在线联机」→ 输入房间号 →「加入房间」
3. 各自选角色，房主点「开打」
4. 联机走 WebRTC P2P，房间号通过公共信令服务器建立连接；同一网络下最稳，部分严格 NAT 网络可能连不上（此时可换网络重试）

## 本地运行

因为使用了 ES Module，需要通过 HTTP 打开，不能直接双击 index.html。

```bash
# 任选一种
python -m http.server 8000
npx http-server -p 8000
```

然后浏览器打开 `http://localhost:8000/`。

## 技术栈

- [Three.js](https://threejs.org/) 0.160（CDN ESM，无构建）
- [PeerJS](https://peerjs.com/) 1.5.4（WebRTC 联机，CDN UMD）
- Web Audio API（程序化音效）
- 原生 HTML/CSS/JavaScript，零构建、零依赖安装

## 目录结构

```
geng-wang-brawl/
├── index.html          # 所有界面
├── css/style.css       # 霓虹街机风格 UI
├── assets/favicon.svg
└── js/
    ├── config.js       # 常量、角色、招式帧数据、键位
    ├── main.js         # 入口、屏幕切换、选角、对局生命周期
    ├── input.js        # 键盘 + 触屏输入
    ├── audio.js        # Web Audio 合成音效与 BGM
    ├── characters.js   # 角色 / 摩托程序化建模
    ├── anim.js         # 程序化关节动画
    ├── scenes.js       # 舞台 / 大排档场景
    ├── effects.js      # 粒子、飘字、震屏、横幅演出
    ├── fighter.js      # 战斗状态机、判定、物理
    ├── ai.js           # CPU 与训练假人
    ├── battle.js       # 对局编排、HUD、相机、网络同步
    └── online.js       # PeerJS 房间封装
```

## 部署

仓库已配置 GitHub Actions 自动部署（见 `.github/workflows/deploy.yml`）：

- 每次向 `main` 分支推送代码，会自动构建并发布到 GitHub Pages
- 首次启用需：仓库 **Settings → Pages → Build and deployment → Source 选择 "GitHub Actions"**
- 部署成功后访问 `https://<你的用户名>.github.io/<仓库名>/`

工作流使用官方 `actions/upload-pages-artifact` + `actions/deploy-pages`，无需构建，直接把当前目录静态文件发布；无需安装任何依赖。

## 说明

本作为同人学习 / 娱乐项目，角色均为程序化原创几何体造型，不含任何第三方美术或音频资源；玩法灵感来自网络热梗格斗游戏。
