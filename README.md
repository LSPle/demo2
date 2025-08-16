# 数据库优化平台

一个基于React和Ant Design的数据库优化管理平台前端项目。

## 功能特性

- 📊 **实例概览** - 数据库实例运行状态总览
- 🛠️ **实例管理** - 添加、删除和配置数据库实例
- 🔍 **SQL审核优化** - SQL语句性能分析和优化建议
- 💻 **SQL窗口** - 在线SQL查询执行
- ⚙️ **配置优化** - 数据库配置参数分析和优化
- 🏗️ **架构优化** - 数据库架构设计优化

## 技术栈

- **前端框架**: React 18.2.0
- **UI组件库**: Ant Design 5.2.0
- **路由管理**: React Router DOM 6.8.0
- **样式方案**: Styled Components + CSS
- **图标库**: Ant Design Icons
- **动画效果**: React Transition Group

## 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm start
```

项目将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

### 运行测试

```bash
npm test
```

## 项目结构

```
src/
├── components/          # 公共组件
│   ├── Layout/         # 布局组件
│   └── PageTransition/ # 页面过渡动画
├── pages/              # 页面组件
│   ├── InstanceOverview.js     # 实例概览
│   ├── InstanceManagement.js   # 实例管理
│   ├── SQLOptimization.js      # SQL优化
│   ├── SQLConsole.js           # SQL窗口
│   └── ConfigOptimization.js   # 配置优化
├── App.js              # 主应用组件
├── index.js            # 应用入口
└── index.css           # 全局样式
```

## 主要功能模块

### 实例概览
- 数据库实例状态监控
- 性能指标展示
- 资源使用情况统计

### 实例管理
- 数据库实例的增删改查
- 实例配置管理
- 连接状态监控

### SQL优化
- SQL语句性能分析
- 优化建议生成
- 执行计划查看

### 配置优化
- 数据库参数分析
- 性能配置建议
- 配置变更管理

## 开发说明

本项目采用现代化的前端开发技术栈，具有以下特点：

- 响应式设计，支持多种屏幕尺寸
- 丰富的动画效果和交互体验
- 模块化的组件设计
- 清晰的代码结构和注释

## 许可证

MIT License