# GPT 娘额度挂件 · Portdan 社区版

基于 [T7moris/GPT-Niang v1.4.0-beta.4](https://github.com/T7moris/GPT-Niang/tree/v1.4.0-beta.4) 的 Windows 社区分支。桌面挂件和 MCP 工具可显示 Portdan API 账户的美元余额和今日实际费用，Codex 订阅模式仍显示订阅额度。

## 安装

1. 在 [Releases](https://github.com/cyy2509/GPT-Niang-Relay/releases) 下载 Windows ZIP，完整解压。
2. 在 Windows x64 上运行解压目录内的 `安装GPT娘.cmd`。
3. 安装器会读取本机 Codex 配置并显示识别结果。挂件余额适配读取当前提供商配置，支持 `env_key` 指向的环境变量和现有 `experimental_bearer_token`。凭据只用于向 `https://portdan.com/v1/usage` 发起查询。请勿将真实密钥提交到 GitHub。

Portdan 自带适配。要接入其他中转站，把 `balance-providers.example.json` 复制到 Codex 配置目录，与 `config.toml` 放在一起，改名为 `gpt-niang-balance-providers.json`。将示例域名替换为当前 Codex 提供商的 HTTPS 来源，填入站点文档中的余额接口路径、币种和 JSON 字段。今日实扣字段是可选的。

自定义接口须接受同一站点的 Codex API Key 作为 Bearer 凭据，并通过 HTTPS GET 返回 JSON。配置示例只保存接口和字段，凭据沿用 Codex 配置。重开挂件以加载已安装的新代码。

## 致谢与许可

感谢 T7moris 和 GPT-Niang 贡献者。源码和文档使用 [MIT](LICENSE)。上游角色素材随项目非商业分发，适用[素材声明](gpt-niang-usage/assets/CHARACTER-NOTICE.txt)和[来源说明](gpt-niang-usage/assets/生成说明.md)。

交互参考 MeteorNOX 的 DeepSeek-Balance-Whale-Widget，内置上游语录见[语录许可](gpt-niang-usage/assets/quotes-LICENSE.txt)。
