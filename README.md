# AI Image Studio

> 买了 gpt-image-2 中转 API 却不知道怎么用？这个工具帮你一键搞定。
> Bought a gpt-image-2 API proxy but don't know how to call it? This tool makes it simple.

[简体中文](#简体中文) | [English](#english) | [繁體中文](#繁體中文)

---

## 简体中文

### 这是什么？

很多用户购买了 gpt-image-2 的中转 API 服务，拿到一个 URL 和 API Key，却不知道怎么调用——需要写代码、处理请求格式、解析返回数据，非常麻烦。

**AI Image Studio** 解决了这个问题。启动后打开浏览器，填入你的 API URL、Key 和模型名称，就能像使用 ChatGPT 一样直接在界面上生成图像。不需要写任何代码。

### 快速开始

```bash
git clone https://github.com/Raines-01/ai-image-studio.git
cd ai-image-studio
pip install requests
python3 app.py
```

浏览器自动打开。首次启动会引导你完成配置：

1. 填入你的中转 API URL（如 `https://xxx.com/v1`）
2. 填入 API Key
3. 模型名称填 `gpt-image-2`（或其他模型）
4. 点击测试连接，成功后保存即可开始使用

### 主要功能

- 文生图 / 图生图（自动检测模式）
- 批量生成 + 任务队列
- 历史记录浏览、搜索、删除
- 多组 API 配置切换
- 自定义输出目录
- 暗色主题，跨平台支持

### 配置说明

你需要从 API 服务商获取以下信息：

| 配置项 | 说明 | 示例 |
|--------|------|------|
| API URL | 中转服务的地址，以 `/v1` 结尾 | `https://api.example.com/v1` |
| API Key | 你的密钥 | `sk-xxxxx` |
| 模型名称 | 要使用的模型 | `gpt-image-2` |

配置保存在 `~/.ai-image-studio/config.json`，启动后可在设置中随时修改。

### 许可证

[MIT](LICENSE)

---

## English

### What is this?

Many users purchase third-party API access to gpt-image-2 and receive a URL and API Key — but then struggle with writing code to call the API, handling request formats, and parsing responses.

**AI Image Studio** solves this. Launch it, open your browser, enter your API URL, Key, and Model name — then generate images through a visual interface, as simple as using ChatGPT. No coding required.

### Quick Start

```bash
git clone https://github.com/Raines-01/ai-image-studio.git
cd ai-image-studio
pip install requests
python3 app.py
```

The browser opens automatically. On first launch, a wizard guides you through setup:

1. Enter your API URL (e.g. `https://xxx.com/v1`)
2. Enter your API Key
3. Model name: `gpt-image-2` (or other)
4. Test the connection, save, and start generating

### Features

- Text-to-image / Image editing (auto-detected)
- Batch generation + task queue
- History browsing, search, delete
- Multiple API config profiles
- Custom output directory
- Dark theme, cross-platform

### Configuration

You need these from your API provider:

| Field | Description | Example |
|-------|-------------|---------|
| API URL | Proxy service address, ending with `/v1` | `https://api.example.com/v1` |
| API Key | Your secret key | `sk-xxxxx` |Model name | Model to use | `gpt-image-2` |

Config is saved at `~/.ai-image-studio/config.json`. Can be modified anytime in Settings.

### License

[MIT](LICENSE)

---

## 繁體中文

### 這是什麼？

許多用戶購買了 gpt-image-2 的中轉 API 服務，拿到 URL 和 API Key，卻不知道怎麼呼叫——需要寫程式碼、處理請求格式、解析回傳資料，非常麻煩。

**AI Image Studio** 解決了這個問題。啟動後開啟瀏覽器，填入你的 API URL、Key 和模型名稱，就能像使用 ChatGPT 一樣直接在介面上生成圖像。不需要寫任何程式碼。

### 快速開始

```bash
git clone https://github.com/Raines-01/ai-image-studio.git
cd ai-image-studio
pip install requests
python3 app.py
```

瀏覽器自動開啟。首次啟動會引導你完成設定：

1. 填入你的中轉 API URL（如 `https://xxx.com/v1`）
2. 填入 API Key
3. 模型名稱填 `gpt-image-2`（或其他模型）
4. 點擊測試連線，成功後儲存即可開始使用

### 主要功能

- 文生圖 / 圖生圖（自動偵測模式）
- 批次生成 + 任務佇列
- 歷史記錄瀏覽、搜尋、刪除
- 多組 API 設定切換
- 自訂輸出目錄
- 深色主題，跨平台支援

### 設定說明

你需要從 API 服務商取得以下資訊：

| 設定項 | 說明 | 範例 |
|--------|------|------|
| API URL | 中轉服務的位址，以 `/v1` 結尾 | `https://api.example.com/v1` |
| API Key | 你的金鑰 | `sk-xxxxx` |
| 模型名稱 | 要使用的模型 | `gpt-image-2` |

設定儲存在 `~/.ai-image-studio/config.json`，啟動後可在設定中隨時修改。

### 授權條款

[MIT](LICENSE)
