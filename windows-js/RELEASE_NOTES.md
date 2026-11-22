## Windows Electron 社区测试版

基于 [GPT-Niang v1.4.0-beta.4](https://github.com/T7moris/GPT-Niang/releases/tag/v1.4.0-beta.4)。感谢 T7moris 和项目贡献者。

- 修复气泡中金额、币种与标签换行重叠。币种显示在标题，金额单行显示，悬停可查看完整数值。
- 内置 Portdan 余额和今日实际费用查询。其他中转站可通过包内的 `balance-providers.example.json` 配置。
- 安装时读取当前 Codex 提供商配置。余额查询沿用同站凭据。
- 保留上游订阅额度和本地 Token 用量估算。

下载 Windows x64 ZIP，完整解压，双击 `安装GPT娘.cmd`。随包提供 `SHA256SUMS.txt`。
