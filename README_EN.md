# MySQL Database Export Tool | [中文版本](README.md)

This tool is designed to export data from MySQL databases, generating standard SQL files compatible with MySQL 8.0, maintaining relationships between tables, and allowing for direct import into other MySQL databases.

## Features

- ✅ Export database table structures (CREATE TABLE statements)
- ✅ Export table data (INSERT statements)
- ✅ Maintain foreign key relationships between tables
- ✅ Support batch processing for large databases
- ✅ Support time range filtering
- ✅ Support record count limits
- ✅ Automatic full export for small tables
- ✅ Compatible with MySQL 5.7 and MySQL 8.0
- ✅ Properly handle all data types (including JSON, BLOB, etc.)
- ✅ Automatic database version detection
- ✅ Detailed error handling and logging

## Installation

1. Clone the repository
2. Install dependencies:
```bash
# Using yarn
yarn install

# Or using npm
npm install
```

## Configuration

Copy the `env.template` file to `.env`, then configure the following settings in the `.env` file:

### Database Connection Configuration
```
# Database connection configuration
DB_HOST=localhost        # Database host address
DB_USER=your_username    # Database username
DB_PASSWORD=your_password # Database password
DB_NAME=your_database_name # Database name
DB_PORT=3306             # Database port
```

### Data Limit Configuration
```
# Maximum number of records to export per table (0 means no limit)
MAX_ROWS_PER_TABLE=0
# Number of records to process in each batch, to avoid memory overflow
BATCH_SIZE=10000
# If table has fewer records than this value, ignore other limitations and export all data (0 to disable this feature)
SMALL_TABLE_THRESHOLD=10000
```

### Time Filtering Configuration
```
# Whether to export only recent data (true/false)
EXPORT_RECENT_ONLY=false
# If exporting recent data only, which time field to use (e.g.: created_at, updated_at)
TIME_FIELD=created_at
# If exporting recent data only, export data from the last X days
RECENT_DAYS=30

# Time range configuration
# Whether to use time range limit (true/false)
USE_TIME_RANGE=false
# Start time (format: YYYY-MM-DD HH:mm:ss)
START_TIME=2024-01-01 00:00:00
# End time (format: YYYY-MM-DD HH:mm:ss)
END_TIME=2024-12-31 23:59:59
```

## Usage

Run the export script:
```bash
node export.js
```

The exported SQL file will be saved in the `export` directory, with the filename format: `database_name_export_date.sql`

## Small Table Processing

To improve export efficiency and maintain data integrity, this tool implements automatic full export for small tables:

- When a table has fewer records than the value set in `SMALL_TABLE_THRESHOLD` (default 10,000), it will automatically ignore other filtering conditions and export all data from that table
- This ensures data integrity for small tables while applying filtering conditions to larger tables
- You can adjust the value of `SMALL_TABLE_THRESHOLD` to change the criteria for small tables
- Setting this value to 0 will disable this feature

## Importing to Other Databases

The exported SQL file can be directly imported into other MySQL databases:

```bash
# Method 1: Using MySQL command line
mysql -u username -p target_database < export/your_database_export_date.sql

# Method 2: Using MySQL Workbench or other GUI tools
# In MySQL Workbench, select: Server -> Data Import -> Import from Self-Contained File
```

## Export Examples

### Example 1: Export the entire database
```
DB_HOST=example.com
DB_USER=admin
DB_PASSWORD=password
DB_NAME=mydb
DB_PORT=3306
```

### Example 2: Export data from the last 7 days, but export small tables in full
```
EXPORT_RECENT_ONLY=true
TIME_FIELD=created_at
RECENT_DAYS=7
SMALL_TABLE_THRESHOLD=10000
```

### Example 3: Export data within a specific date range
```
USE_TIME_RANGE=true
START_TIME=2024-01-01 00:00:00
END_TIME=2024-01-31 23:59:59
```

### Example 4: Limit export to 1,000 records per table (except small tables)
```
MAX_ROWS_PER_TABLE=1000
SMALL_TABLE_THRESHOLD=5000
```

### Example 5: Process large tables by adjusting batch size
```
BATCH_SIZE=5000
```

## Important Notes

- Ensure you have enough disk space to store the exported data
- For large databases, the export process may take a long time
- It is recommended to run exports during off-peak hours
- If you encounter memory overflow issues, reduce the `BATCH_SIZE` value
- When importing, check that the target database's character set and collation are compatible

## Troubleshooting

### Connection Timeout
If you encounter a connection timeout issue, check:
1. Is the database server address correct?
2. Does the server allow remote connections?
3. Is the corresponding port open in the firewall?

### Memory Overflow
If you encounter memory overflow issues, try the following solutions:
1. Reduce the `BATCH_SIZE` value, e.g., set to 5000 or 1000
2. Use `MAX_ROWS_PER_TABLE` to limit the number of records per table
3. Use time range filtering to reduce the amount of data

### Version Compatibility Issues
If you encounter version compatibility issues when importing, such as errors when importing data exported from MySQL 5.7 into MySQL 8.0, ensure:
1. You are using the latest version of the export script
2. Check the target database's character set and collation settings

---

## About Us

We are Web5Team, focusing on AI and blockchain software development. Our team is based in Hong Kong with distributed development teams in mainland China and overseas. We accept various software development projects (within legal boundaries).

Contact us: Email zxy@demohub.top (remove @ to prevent crawlers) 