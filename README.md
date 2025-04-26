# MySQL 数据库导出工具

这个工具用于导出 MySQL 数据库中的数据，生成标准的 SQL 文件，可以直接导入到其他 MySQL 数据库。

## 功能特点

- 导出数据库表结构（CREATE TABLE 语句）
- 导出表数据（INSERT 语句）
- 保持表之间的外键关系
- 导出为标准的 SQL 格式
- 支持 MySQL 5.7

## 安装

1. 克隆仓库
2. 安装依赖：
```bash
yarn install
```

## 配置

1. 复制 `.env.example` 文件为 `.env`
2. 在 `.env` 文件中配置数据库连接信息：
```
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=your_database_name
DB_PORT=3306
```

## 使用方法

运行导出脚本：
```bash
node export.js
```

导出的 SQL 文件将保存在 `export` 目录下，文件名格式为：`数据库名_export_日期.sql`

## 导出文件格式

导出的 SQL 文件包含：
- 数据库创建语句
- 表结构（CREATE TABLE 语句）
- 表数据（INSERT 语句）
- 外键约束

## 导入到其他数据库

导出的 SQL 文件可以直接导入到其他 MySQL 数据库：

```bash
mysql -u username -p database_name < export/your_database_export_date.sql
```

## 注意事项

- 确保有足够的磁盘空间存储导出的数据
- 对于大型数据库，导出过程可能需要较长时间
- 建议在非高峰期执行导出操作
- 导入时注意检查目标数据库的字符集和排序规则是否匹配 