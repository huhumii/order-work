# 企业午餐点餐系统

企业午餐点餐系统，支持员工点餐、桌台单、管理员菜品维护和报单汇总。

Docker 版本内置 Python 标准库后端 API，并使用 SQLite 持久化保存菜单、菜品库和订单状态。

## Docker 运行

```bash
docker compose up -d --build
```

打开：

```text
http://localhost:3880
```

停止：

```bash
docker compose down
```

查看健康状态：

```bash
docker compose ps
```

## 管理员

管理员密码：

```text
Wu123456
```

## 说明

数据保存在 Docker volume `order-work-data` 中的 SQLite 数据库里。浏览器本地缓存只作为离线兜底。

员工端会定时检查桌台单更新，优先局部同步桌台单，不打断正在浏览或填写的员工。

API 健康检查：

```text
http://localhost:3880/api/health
```

状态接口：

```text
http://localhost:3880/api/state
```
