# Sealos App Launchpad 部署指引

目标环境：Sealos 北京区（bja.sealos.run），镜像由本仓库 `Dockerfile` 构建，启动命令 `node server.js`，容器端口 3000。

---

## 1. 前置条件

- 代码已推到 `master`（本仓库：`https://github.com/Scarlett713/memory-engine`）。
- `.github/workflows/docker-image.yml` 已在仓库里 —— 每次 push 到 `master` 会自动构建并推送镜像到 GitHub Container Registry。
- 首次构建可在仓库 **Actions → Build and Push Docker Image → Run workflow** 手动触发，约 3–5 分钟。

---

## 2. 镜像来源（二选一）

### A. GitHub Actions 自动构建（推荐，零本地操作）

镜像地址：

```
ghcr.io/scarlett713/memory-engine:master
ghcr.io/scarlett713/memory-engine:latest
```

- `:master` 跟随 master 最新提交；`:latest` 每次推送都会覆盖。
- 包默认是 **私有** 的。Sealos 拉取需要在镜像配置里填凭据：
  - 用户名：GitHub 用户名（`Scarlett713`）
  - 密码：GitHub **Personal Access Token**（勾 `read:packages`）
- 如果 IP 出口在国内拉 ghcr.io 很慢，直接用方案 B。

### B. 本地构建 + 推送到国内镜像仓库

```bash
docker build -t registry.cn-beijing.aliyuncs.com/<你的命名空间>/memory-engine:v1 .
docker push registry.cn-beijing.aliyuncs.com/<你的命名空间>/memory-engine:v1
```

然后 Sealos 里填这个地址，同样需要配好阿里云仓库的账号密码。

---

## 3. App Launchpad 填写参数

| 项 | 建议值 | 说明 |
| --- | --- | --- |
| 镜像 | `ghcr.io/scarlett713/memory-engine:master` | 或方案 B 的 ACR 地址 |
| CPU | 0.5 核 | 纯页面浏览够用 |
| 内存 | 512 MB | 起步值；**要传 50MB 以上的音频，调到 1 核 1GB**（上传内容会整个读进内存） |
| 副本数 | **1** | 数据存在 `/app/storage` 的 JSON 文件里，多副本会各写各的，等于数据分裂 |
| 容器端口 | `3000` | 与镜像 `EXPOSE 3000` 一致 |
| 外网访问 | 开启 | Sealos 会给一个 `https://xxx.bja.sealos.run` 的域名 |
| 启动命令 | 留空 | 镜像里已有 `CMD`，不要覆盖 |
| 存储卷 | PVC，5–10 GiB | 挂载路径填 `/app/storage` |

**关于存储卷**

- 挂载路径必须是 `/app/storage`：程序读写 `process.cwd() + LOCAL_STORAGE_DIR`，容器工作目录是 `/app`，`LOCAL_STORAGE_DIR` 缺省就是 `storage`。
- 账号（`users.json`）、项目库（`projects.json`）、上传的音频（`uploads/`）**全部**在这一个目录下，挂一个卷就够。
- 首次启动目录为空是正常的，程序会自动初始化；反之，重新部署时卷里的数据会保留。

---

## 4. 环境变量清单

在 App Launchpad 的「环境变量」里逐条添加。**值全部留空，由部署者自己填。**

| 变量 | 必填 | 示例 / 取值 | 说明 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_APP_NAME` | 否 | `记忆引擎` | **构建期**注入，运行时改无效；要改名必须重新构建镜像（`docker build --build-arg NEXT_PUBLIC_APP_NAME=xxx`） |
| `LOCAL_STORAGE_DIR` | 否 | `storage` | 必须与挂载路径最后一段一致，改了就要同步改挂载点 |
| `JWT_SECRET` | **是** | `openssl rand -base64 32` 生成 | 缺失不报错，但会退回源码里写死的开发密钥，任何人可伪造登录态 |
| `TRANSCRIPTION_PROVIDER` | 是 | `mock` / `volcengine` / `xfyun` | 不填等同 `mock`（假转写，只走通流程） |
| `TRANSCRIPTION_API_URL` | 用火山时 | `https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash` | 火山录音文件识别 |
| `TRANSCRIPTION_API_RESOURCE_ID` | 用火山时 | `volc.bigasr.auc_turbo` | |
| `TRANSCRIPTION_APP_ID` | 用火山时 | | 火山控制台 AppID |
| `TRANSCRIPTION_API_KEY` | 用火山时 | | 火山 Access Token |
| `XFYUN_APP_ID` | 用讯飞时 | | 仅 `TRANSCRIPTION_PROVIDER=xfyun` |
| `XFYUN_SECRET_KEY` | 用讯飞时 | | 仅 `TRANSCRIPTION_PROVIDER=xfyun` |
| `LLM_PROVIDER` | 是 | `mock` / `ark` | `ark` = 火山方舟，实际后端是 DeepSeek |
| `LLM_API_URL` | 用 ark 时 | `https://ark.cn-beijing.volces.com/api/v3/responses` | |
| `LLM_API_KEY` | 用 ark 时 | | 方舟 API Key |
| `LLM_MODEL` | 用 ark 时 | `deepseek-v3-2-251201` | 填方舟上的推理接入点名，不是模型名 |

> 注意：`LLM_PROVIDER=ark` 但 `LLM_API_KEY` 为空时，程序会**静默退回 mock**，页面不报错，只是回答变成模板文案。判断是否真的接上了，看 AI 回答里有没有「（Mock 模式）」字样。

---

## 5. 首次部署后的验证

1. 打开 Sealos 给的外网域名 → 应跳转到 `/login`。
2. 点「注册」建一个账号 → 能进首页。
3. 新建一个项目、跑一遍提纲 → 能看到生成结果（mock 模式下走模板，属正常）。
4. 回到存储卷，挂载目录下应出现 `users.json`、`projects.json`、`uploads/`。
5. 在 Sealos 里「重新部署」一次 → 账号仍能登录（说明卷挂对了；登录丢 = 卷没挂上，数据写在容器层）。

---

## 6. 后续更新

```bash
git push origin master     # 触发 Actions 构建
```

Actions 绿了之后，在 App Launchpad 里点「重新部署」。如果平台缓存了旧镜像，把镜像 tag 换成 `master`（而非 `latest`）或手动改 `imagePullPolicy` 为 `Always`。

---

## 7. 已知限制

| 限制 | 影响 / 处理 |
| --- | --- |
| 单副本 | 多副本会导致 JSON 数据互相覆盖，扩容前必须先换数据库 |
| JSON 文件存储 | 并发写入靠进程内锁；几十人同时用没问题，再往上要迁移到 Postgres |
| 上传体积 | 程序侧上限 100MB（`upload-store.ts`），网关侧可能更低；如果 413，去平台把请求体上限调大 |
| 备份 | 依赖卷快照；`storage/` 里 `projects.json`、`users.json` 是全部数据，定期打包导出 |
| 构建期变量 | `NEXT_PUBLIC_*` 在 build 时烤进产物，改了必须重新构建镜像 |

---

## 附：本机验证（无 Sealos 也能跑）

```bash
docker build -t memory-engine:local .
docker run -p 3000:3000 -v $(pwd)/storage:/app/storage \
  -e JWT_SECRET=$(openssl rand -base64 32) memory-engine:local
```

镜像约 250–300MB（Alpine 基础镜像 ~180MB + standalone 产物 ~64MB），冷启动 1–2 秒。
