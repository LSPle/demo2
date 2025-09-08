# GitHub代码上传问题解决方案

## 问题描述
在使用VPN的情况下，Git推送代码到GitHub时仍然失败，提示连接超时。

## 错误原因
**核心问题**: Git没有配置使用VPN代理

### 技术原理
- VPN在系统级别工作，但Git不会自动使用系统代理
- Git使用libcurl库进行网络请求，需要手动配置代理
- 浏览器能访问GitHub ≠ Git能访问GitHub

## 解决步骤

### 1. 确认VPN代理端口
常见VPN软件的本地代理端口：
- Clash: 7890
- V2Ray: 1080  
- Shadowsocks: 1080

### 2. 配置Git代理
```bash
# 配置HTTP代理
git config --global http.proxy http://127.0.0.1:7890

# 配置HTTPS代理
git config --global https.proxy http://127.0.0.1:7890
```

### 3. 验证配置
```bash
# 查看当前代理配置
git config --global --get http.proxy
git config --global --get https.proxy
```

### 4. 推送代码
```bash
git push origin main
```

## 清除代理配置
如果不需要代理时：
```bash
git config --global --unset http.proxy
git config --global --unset https.proxy
```

## 预防措施
1. 记录VPN软件的代理端口设置
2. 在VPN环境下首次使用Git时检查代理配置
3. 定期验证Git网络配置是否正确

## 故障排查
如果仍然失败：
1. 确认VPN是否正常工作（测试浏览器访问GitHub）
2. 检查代理端口是否正确
3. 尝试SSH连接方式
4. 考虑使用GitHub Desktop客户端

---
*创建时间: 2024年*
*适用场景: VPN环境下的Git操作*