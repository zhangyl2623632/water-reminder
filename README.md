# 喝水提醒 · Water Reminder

两个**纯本地、不联网**的喝水提醒实现，规则一致：默认每 60 分钟一次、时段 09:00–21:00，时段外静默，一次只出一条短提示，文案随机不连着重复。

| 目录 | 是什么 | 跑在哪 |
|---|---|---|
| [`android/`](android) | 独立 Android App：到点从屏幕顶部弹横幅 + 提示音 + 震动 | 手机 |
| [`dsh-plugin/`](dsh-plugin) | DeepSeek Harness 插件：在应用内弹卡片，可在对话里用一句话改配置 | 电脑 |

两者的配置互不同步 —— 都只存在各自的设备上，没有任何网络请求。

## android/

纯 Android SDK 手写，**没有 Gradle、没有第三方依赖**，用 JDK + Android build-tools 直接打包。

```
android/
├── AndroidManifest.xml
├── res/drawable/ic_launcher.xml
├── src/dev/local/waterreminder/
│   ├── MainActivity.java      一屏：状态 + 间隔/起止时间 + 保存 / 暂停 / 预览
│   ├── Schedule.java          纯时间计算（时段、下次触发、跨零点）
│   ├── Plan.java              SharedPreferences 配置
│   ├── Alarms.java            AlarmManager 排下一次
│   ├── ReminderReceiver.java  到点：发通知 + 排下一次
│   ├── BootReceiver.java      重启后恢复闹钟
│   └── Notifier.java          高优先级通知渠道（横幅/声音/震动）
├── test/…/ScheduleTest.java   时间算法的 JVM 测试
├── build.ps1                  一条命令出 APK
└── water-reminder.apk         已签名产物，可直接安装
```

**安装**：把 `water-reminder.apk` 传到手机 → 允许「安装未知来源应用」→ 安装 → 首次打开允许通知。

**装完必须设置**（否则不会弹横幅）：

1. 系统设置 → 通知 → 找到「喝水提醒（横幅+声音）」渠道 → 打开 **横幅 / 悬浮通知** 和 **声音**；
2. 电池 / 应用启动管理里允许 **自启动** 和 **后台运行**，不要限制省电。

**重新打包**：需要 JDK 21 + Android build-tools（`aapt2`/`d8`/`zipalign`/`apksigner`），把工具解包到 `_ma_build/` 后运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File android/build.ps1
```

签名钥匙不在仓库里（`*.jks` 已忽略）。第一次打包会生成一个新的，之后覆盖安装要沿用同一个钥匙。

**执行提醒的边界**：依赖系统闹钟与通知权限。省电模式或系统清理后台时可能延迟几分钟；关掉通知就收不到。

## dsh-plugin/

给 [DeepSeek Harness](https://github.com/) 用的插件包，通过 Plugin Manager 从本地目录安装（`install_bundle`）。

- **弹卡**：到点在窗口底部弹一张卡片，一次一条，点「收到，这就喝」安静等下一轮，120 秒无操作自动收起。
- **设置页**：设置 → 喝水提醒 —— 状态、下次时间、今日次数、间隔 / 起止时间、暂停继续、恢复默认、预览一条。
- **状态胶囊**：输入框下方 `💧 下次 16:33`，右侧一键暂停。
- **对话控制**：直接说 `暂停` / `继续` / `修改间隔 30 分钟` / `修改时段 10:00–18:00` / `重置默认` / `查看设置`，走 `water_reminder` 工具。
- **状态文件**：`~/.dsh/water-reminder.state.json`；早期版本落在用户目录，启动时自动迁移。
- **接口**：客户端通过 `GET /water-reminder/state`、`POST /water-reminder/action` 与宿主同步，只监听回环地址。

源码结构见 [`dsh-plugin/`](dsh-plugin)：`index.js` 是宿主（调度 / 持久化 / 路由 / 工具），`client.js` 是界面（三个 slot）。

## 隐私

两个实现都不上传、不联网同步：配置和计数只写在各自设备的本地存储里。
