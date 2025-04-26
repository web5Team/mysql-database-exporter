# MySQL 数据库导出工具 | [English Version](README_EN.md)

这个工具用于导出 MySQL 数据库中的数据，生成兼容 MySQL 8.0 的标准 SQL 文件，保持表之间的关联关系，并可以直接导入到其他 MySQL 数据库。

## 功能特点

- ✅ 导出数据库表结构（CREATE TABLE 语句）
- ✅ 导出表数据（INSERT 语句）
- ✅ 保持表之间的外键关系
- ✅ 支持大型数据库的分批处理
- ✅ 支持时间范围筛选
- ✅ 支持记录数量限制
- ✅ 小表自动全量导出功能
- ✅ 兼容 MySQL 5.7 和 MySQL 8.0
- ✅ 正确处理所有数据类型（包括 JSON、BLOB 等）
- ✅ 自动检测数据库版本
- ✅ 详细的错误处理和日志

## 安装

1. 克隆仓库
2. 安装依赖：
```bash
# 使用 yarn 安装
yarn install

# 或使用 npm 安装
npm install
```

## 配置

复制 `env.template` 文件为 `.env`，然后在 `.env` 文件中配置以下信息：

### 数据库连接配置
```
# 数据库连接配置
DB_HOST=localhost        # 数据库主机地址
DB_USER=your_username    # 数据库用户名
DB_PASSWORD=your_password # 数据库密码
DB_NAME=your_database_name # 数据库名称
DB_PORT=3306             # 数据库端口
```

### 数据量限制配置
```
# 每个表最多导出的记录数（0表示不限制）
MAX_ROWS_PER_TABLE=0
# 每批处理记录数，避免内存溢出
BATCH_SIZE=10000
# 如果表记录数少于此值，则忽略其他限制，全部导出（0表示禁用此功能）
SMALL_TABLE_THRESHOLD=10000
```

### 时间筛选配置
```
# 是否只导出最近的数据（true/false）
EXPORT_RECENT_ONLY=false
# 如果只导出最近数据，使用哪个时间字段（例如：created_at, updated_at）
TIME_FIELD=created_at
# 如果只导出最近数据，导出最近多少天的数据
RECENT_DAYS=30

# 时间范围配置
# 是否使用时间范围限制（true/false）
USE_TIME_RANGE=false
# 开始时间（格式：YYYY-MM-DD HH:mm:ss）
START_TIME=2024-01-01 00:00:00
# 结束时间（格式：YYYY-MM-DD HH:mm:ss）
END_TIME=2024-12-31 23:59:59
```

## 使用方法

运行导出脚本：
```bash
node export.js
```

导出的 SQL 文件将保存在 `export` 目录下，文件名格式为：`数据库名_export_日期.sql`

## 小表处理功能

为了提高导出效率并保持数据完整性，该工具实现了小表自动全量导出功能：

- 当表的记录数少于 `SMALL_TABLE_THRESHOLD` 设置的值时（默认 10000 条），会自动忽略其他限制条件，全部导出该表数据
- 这样可以确保小表的数据完整性，同时对大表应用筛选条件
- 可以通过调整 `SMALL_TABLE_THRESHOLD` 的值来改变小表的判定标准
- 将此值设置为 0 可以禁用该功能

## 导入到其他数据库

导出的 SQL 文件可以直接导入到其他 MySQL 数据库：

```bash
# 方法 1：使用 MySQL 命令行
mysql -u username -p target_database < export/your_database_export_date.sql

# 方法 2：使用 MySQL Workbench 或其他 GUI 工具导入
# 在 MySQL Workbench 中选择：Server -> Data Import -> Import from Self-Contained File
```

## 导出示例

### 示例 1：导出整个数据库
```
DB_HOST=example.com
DB_USER=admin
DB_PASSWORD=password
DB_NAME=mydb
DB_PORT=3306
```

### 示例 2：导出最近 7 天的数据，但小表全部导出
```
EXPORT_RECENT_ONLY=true
TIME_FIELD=created_at
RECENT_DAYS=7
SMALL_TABLE_THRESHOLD=10000
```

### 示例 3：导出指定日期范围的数据
```
USE_TIME_RANGE=true
START_TIME=2024-01-01 00:00:00
END_TIME=2024-01-31 23:59:59
```

### 示例 4：限制导出数量，每表最多 1000 条记录（但小表除外）
```
MAX_ROWS_PER_TABLE=1000
SMALL_TABLE_THRESHOLD=5000
```

### 示例 5：处理大型表，调整批处理大小
```
BATCH_SIZE=5000
```

## 注意事项

- 确保有足够的磁盘空间存储导出的数据
- 对于大型数据库，导出过程可能需要较长时间
- 建议在非高峰期执行导出操作
- 如果遇到内存溢出问题，减小 `BATCH_SIZE` 的值
- 导入时注意检查目标数据库的字符集和排序规则是否兼容

## 疑难解答

### 连接超时
如果遇到连接超时问题，请检查：
1. 数据库服务器地址是否正确
2. 服务器是否允许远程连接
3. 防火墙是否开放了对应端口

### 内存溢出
如果遇到内存溢出问题，尝试以下解决方案：
1. 减小 `BATCH_SIZE` 的值，如设置为 5000 或 1000
2. 使用 `MAX_ROWS_PER_TABLE` 限制每个表的记录数
3. 使用时间范围筛选减少数据量

### 版本兼容性问题
如果在导入时遇到版本兼容性问题，如 MySQL 5.7 导出的数据导入到 MySQL 8.0 时出错，请确保：
1. 使用最新版本的导出脚本
2. 检查目标数据库的字符集和排序规则设置

---

## 关于我们

我们是 Web5Team，专注于人工智能 AI 和区块链软件开发，团队 base 在香港，大陆和海外有分布式开发团队。承接各种软件开发（合法范围）。

欢迎联系：邮件 zxy@demohub.top（防止爬虫，请自行删除 @） 