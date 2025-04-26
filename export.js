require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  // 添加连接超时设置
  connectTimeout: 10000, // 连接超时时间：10秒
  connectionLimit: 10,   // 连接池大小
  // 添加重试选项
  maxRetries: 3,        // 最大重试次数
  acquireTimeout: 30000 // 获取连接超时时间：30秒
};

// 导出限制配置
const exportConfig = {
  maxRowsPerTable: parseInt(process.env.MAX_ROWS_PER_TABLE || '0'),
  exportRecentOnly: process.env.EXPORT_RECENT_ONLY === 'true',
  timeField: process.env.TIME_FIELD || 'created_at',
  recentDays: parseInt(process.env.RECENT_DAYS || '30'),
  // 分批处理配置
  batchSize: parseInt(process.env.BATCH_SIZE || '10000'), // 每批处理的记录数
  // 时间范围配置
  useTimeRange: process.env.USE_TIME_RANGE === 'true',
  startTime: process.env.START_TIME,
  endTime: process.env.END_TIME
};

// 打印数据库配置信息（隐藏密码）
console.log('\n=== 数据库配置信息 ===');
console.log(`主机: ${dbConfig.host}`);
console.log(`端口: ${dbConfig.port}`);
console.log(`用户名: ${dbConfig.user}`);
console.log(`数据库名: ${dbConfig.database}`);
console.log(`密码: ${dbConfig.password ? '******' : '未设置'}`);
console.log(`连接超时: ${dbConfig.connectTimeout}ms`);
console.log(`最大重试次数: ${dbConfig.maxRetries}`);
console.log('=====================\n');

// 打印导出限制配置
console.log('\n=== 导出限制配置 ===');
console.log(`每个表最大记录数: ${exportConfig.maxRowsPerTable === 0 ? '不限制' : exportConfig.maxRowsPerTable}`);
console.log(`只导出最近数据: ${exportConfig.exportRecentOnly ? '是' : '否'}`);
if (exportConfig.exportRecentOnly) {
  console.log(`时间字段: ${exportConfig.timeField}`);
  console.log(`最近天数: ${exportConfig.recentDays}`);
}
console.log(`每批处理记录数: ${exportConfig.batchSize}`);
if (exportConfig.useTimeRange) {
  console.log('\n=== 时间范围配置 ===');
  console.log(`开始时间: ${exportConfig.startTime}`);
  console.log(`结束时间: ${exportConfig.endTime}`);
}
console.log('=====================\n');

// 获取数据库版本信息
async function getDatabaseVersion() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port,
      connectTimeout: dbConfig.connectTimeout
    });

    const [versionResult] = await connection.query('SELECT VERSION() as version');
    console.log(`\n=== 数据库版本信息 ===`);
    console.log(`版本: ${versionResult[0].version}`);
    console.log('=====================\n');

    return versionResult[0].version;
  } catch (error) {
    console.error('获取数据库版本失败:', error.message);
    return null;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// 处理 MySQL 8.0 兼容性
function makeMySQL8Compatible(sql) {
  // 替换 MySQL 8.0 中的保留字
  const reservedWords = [
    'CURRENT_TIMESTAMP',
    'CURRENT_DATE',
    'CURRENT_TIME',
    'CURRENT_USER',
    'LOCALTIME',
    'LOCALTIMESTAMP',
    'NOW',
    'SYSDATE',
    'UTC_DATE',
    'UTC_TIME',
    'UTC_TIMESTAMP'
  ];

  // 处理保留字
  reservedWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    sql = sql.replace(regex, `\`${word}\``);
  });

  // 处理 JSON 类型
  sql = sql.replace(/JSON\s+/gi, 'JSON ');

  // 处理字符集和排序规则
  sql = sql.replace(/CHARACTER SET \w+/gi, 'CHARACTER SET utf8mb4');
  sql = sql.replace(/COLLATE \w+/gi, 'COLLATE utf8mb4_unicode_ci');

  return sql;
}

// 获取表的字段信息和类型
async function getTableColumns(connection, tableName) {
  try {
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME, 
        DATA_TYPE,
        COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = ?
    `, [dbConfig.database, tableName]);
    
    // 转换为字段名 -> 类型的映射
    const columnTypes = {};
    columns.forEach(col => {
      columnTypes[col.COLUMN_NAME] = {
        dataType: col.DATA_TYPE,
        columnType: col.COLUMN_TYPE
      };
    });
    
    return columnTypes;
  } catch (error) {
    console.error(`Error getting column types for table ${tableName}:`, error.message);
    return {};
  }
}

async function getTableStructure(connection, tableName) {
  try {
    const [rows] = await connection.query(`SHOW CREATE TABLE ${tableName}`);
    let structure = rows[0]['Create Table'];
    
    // 处理 MySQL 8.0 兼容性
    structure = makeMySQL8Compatible(structure);
    
    return structure;
  } catch (error) {
    console.error(`Error getting structure for table ${tableName}:`, error.message);
    throw error;
  }
}

async function getTableData(connection, tableName) {
  try {
    let query = `SELECT * FROM ${tableName}`;
    const params = [];

    // 如果设置了只导出最近数据
    if (exportConfig.exportRecentOnly) {
      // 检查表是否有时间字段
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [dbConfig.database, tableName, exportConfig.timeField]);

      if (columns.length > 0) {
        query += ` WHERE ${exportConfig.timeField} >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
        params.push(exportConfig.recentDays);
      } else {
        console.log(`警告: 表 ${tableName} 没有找到时间字段 ${exportConfig.timeField}`);
      }
    }

    // 如果设置了时间范围
    if (exportConfig.useTimeRange) {
      // 检查表是否有时间字段
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [dbConfig.database, tableName, exportConfig.timeField]);

      if (columns.length > 0) {
        const whereClause = exportConfig.exportRecentOnly ? ' AND' : ' WHERE';
        query += `${whereClause} ${exportConfig.timeField} BETWEEN ? AND ?`;
        params.push(exportConfig.startTime, exportConfig.endTime);
      } else {
        console.log(`警告: 表 ${tableName} 没有找到时间字段 ${exportConfig.timeField}`);
      }
    }

    // 如果设置了最大记录数限制
    if (exportConfig.maxRowsPerTable > 0) {
      query += ` LIMIT ?`;
      params.push(exportConfig.maxRowsPerTable);
    }

    const [rows] = await connection.query(query, params);
    return rows;
  } catch (error) {
    console.error(`Error getting data from table ${tableName}:`, error.message);
    throw error;
  }
}

async function getTableDataInBatches(connection, tableName) {
  try {
    let query = `SELECT * FROM ${tableName}`;
    const params = [];
    let whereClause = '';

    // 如果设置了只导出最近数据
    if (exportConfig.exportRecentOnly) {
      // 检查表是否有时间字段
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [dbConfig.database, tableName, exportConfig.timeField]);

      if (columns.length > 0) {
        whereClause = ` WHERE ${exportConfig.timeField} >= DATE_SUB(NOW(), INTERVAL ? DAY)`;
        params.push(exportConfig.recentDays);
      } else {
        console.log(`警告: 表 ${tableName} 没有找到时间字段 ${exportConfig.timeField}`);
      }
    }

    // 如果设置了时间范围
    if (exportConfig.useTimeRange) {
      // 检查表是否有时间字段
      const [columns] = await connection.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = ? 
        AND COLUMN_NAME = ?
      `, [dbConfig.database, tableName, exportConfig.timeField]);

      if (columns.length > 0) {
        const whereClause = exportConfig.exportRecentOnly ? ' AND' : ' WHERE';
        query += `${whereClause} ${exportConfig.timeField} BETWEEN ? AND ?`;
        params.push(exportConfig.startTime, exportConfig.endTime);
      } else {
        console.log(`警告: 表 ${tableName} 没有找到时间字段 ${exportConfig.timeField}`);
      }
    }

    // 获取总记录数
    const countQuery = `SELECT COUNT(*) as total FROM ${tableName}${whereClause}`;
    const [countResult] = await connection.query(countQuery, params);
    const totalRows = countResult[0].total;

    console.log(`表 ${tableName} 总记录数: ${totalRows}`);

    // 分批处理数据
    const batches = [];
    let offset = 0;
    const limit = exportConfig.maxRowsPerTable > 0 ? 
      Math.min(exportConfig.maxRowsPerTable, exportConfig.batchSize) : 
      exportConfig.batchSize;

    while (offset < totalRows && (exportConfig.maxRowsPerTable === 0 || offset < exportConfig.maxRowsPerTable)) {
      const batchQuery = `${query}${whereClause} LIMIT ? OFFSET ?`;
      const batchParams = [...params, limit, offset];
      
      console.log(`处理表 ${tableName} 的第 ${offset + 1} 到 ${Math.min(offset + limit, totalRows)} 条记录`);
      
      const [rows] = await connection.query(batchQuery, batchParams);
      batches.push(rows);
      
      offset += limit;
    }

    return batches.flat();
  } catch (error) {
    console.error(`Error getting data from table ${tableName}:`, error.message);
    throw error;
  }
}

// 处理特殊数据类型值
function formatValueByType(value, columnType) {
  if (value === null) return 'NULL';
  
  const { dataType } = columnType;
  
  switch (dataType.toLowerCase()) {
    case 'json':
      // 处理 JSON 类型
      return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    
    case 'blob':
    case 'binary':
    case 'varbinary':
    case 'tinyblob':
    case 'mediumblob':
    case 'longblob':
      // 处理二进制类型，转为十六进制
      if (Buffer.isBuffer(value)) {
        return `0x${value.toString('hex')}`;
      }
      return `'${value.toString().replace(/'/g, "''")}'`;
    
    case 'bit':
      // 处理位类型
      return value.toString('hex');
    
    case 'timestamp':
    case 'datetime':
    case 'date':
      // 处理日期类型
      if (value instanceof Date) {
        return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
      }
      return `'${value}'`;
    
    case 'char':
    case 'varchar':
    case 'text':
    case 'tinytext':
    case 'mediumtext':
    case 'longtext':
    case 'enum':
    case 'set':
      // 处理字符串类型
      return `'${value.toString().replace(/'/g, "''")}'`;
    
    default:
      // 处理数字和其他类型
      if (typeof value === 'string') {
        return `'${value.replace(/'/g, "''")}'`;
      }
      if (typeof value === 'object' && value instanceof Date) {
        return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
      }
      return value;
  }
}

async function generateInsertStatements(tableName, data, connection) {
  if (!data || data.length === 0) return '';
  
  // 获取表的字段类型信息
  const columnTypes = await getTableColumns(connection, tableName);
  
  const columns = Object.keys(data[0]);
  const values = data.map(row => {
    return `(${columns.map(col => {
      const value = row[col];
      return formatValueByType(value, columnTypes[col] || { dataType: 'unknown' });
    }).join(', ')})`;
  });

  return `INSERT INTO \`${tableName}\` (\`${columns.join('`, `')}\`) VALUES\n${values.join(',\n')};\n\n`;
}

async function tryConnect(config, retries = 0) {
  try {
    console.log(`Attempting to connect to database (attempt ${retries + 1}/${config.maxRetries})...`);
    const connection = await mysql.createConnection({
      ...config,
      connectTimeout: config.connectTimeout
    });
    console.log('Database connection established successfully');

    // 获取数据库版本信息
    const [versionResult] = await connection.query('SELECT VERSION() as version');
    console.log(`数据库版本: ${versionResult[0].version}`);

    return connection;
  } catch (error) {
    if (retries < config.maxRetries - 1) {
      console.log(`Connection failed, retrying in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return tryConnect(config, retries + 1);
    }
    throw error;
  }
}

async function exportDatabase() {
  let connection;
  try {
    // 创建数据库连接（带重试）
    connection = await tryConnect(dbConfig);

    // 获取所有表名
    const [tables] = await connection.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = ?
    `, [dbConfig.database]);

    if (tables.length === 0) {
      console.log('No tables found in the database');
      return;
    }

    let sqlContent = `-- MySQL dump for database: ${dbConfig.database}\n`;
    sqlContent += `-- Generated on: ${new Date().toISOString()}\n`;
    sqlContent += `-- Host: ${dbConfig.host}\n`;
    sqlContent += `-- Database: ${dbConfig.database}\n\n`;
    
    // 添加 MySQL 8.0 兼容性设置
    sqlContent += `SET NAMES utf8mb4;\n`;
    sqlContent += `SET FOREIGN_KEY_CHECKS=0;\n`;
    sqlContent += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
    sqlContent += `SET time_zone = "+00:00";\n\n`;

    // 遍历每个表
    for (const table of tables) {
      const tableName = table.TABLE_NAME;
      console.log(`Processing table: ${tableName}`);

      try {
        // 获取表结构
        const structure = await getTableStructure(connection, tableName);
        sqlContent += `-- Table structure for table \`${tableName}\`\n`;
        sqlContent += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
        sqlContent += `${structure};\n\n`;

        // 获取表数据（分批处理）
        const data = await getTableDataInBatches(connection, tableName);
        if (data.length > 0) {
          console.log(`Exporting ${data.length} rows from table ${tableName}`);
          sqlContent += `-- Data for table \`${tableName}\`\n`;
          sqlContent += await generateInsertStatements(tableName, data, connection);
        } else {
          console.log(`No data in table ${tableName}`);
        }
      } catch (error) {
        console.error(`Error processing table ${tableName}:`, error.message);
        // 继续处理下一个表
        continue;
      }
    }

    sqlContent += `SET FOREIGN_KEY_CHECKS=1;\n`;

    // 创建导出目录
    const exportDir = path.join(__dirname, 'export');
    await fs.mkdir(exportDir, { recursive: true });

    // 保存数据到文件
    const exportPath = path.join(exportDir, `${dbConfig.database}_export_${new Date().toISOString().split('T')[0]}.sql`);
    await fs.writeFile(exportPath, sqlContent);
    
    console.log(`Export completed successfully! Data saved to: ${exportPath}`);

  } catch (error) {
    console.error('Export failed:', error.message);
    if (error.code === 'ETIMEDOUT') {
      console.error('连接超时。请检查：');
      console.error('1. 服务器地址是否正确');
      console.error('2. 服务器是否允许远程连接');
      console.error('3. 防火墙是否开放了对应端口');
      console.error(`4. 是否可以 ping 通服务器: ${dbConfig.host}`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('访问被拒绝。请检查用户名和密码是否正确');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('连接被拒绝。请检查：');
      console.error('1. MySQL 服务是否正在运行');
      console.error('2. 端口号是否正确');
      console.error('3. 服务器防火墙设置');
    }
  } finally {
    if (connection) {
      try {
        await connection.end();
        console.log('Database connection closed');
      } catch (error) {
        console.error('Error closing database connection:', error.message);
      }
    }
  }
}

// 在导出之前获取数据库版本
getDatabaseVersion().then(version => {
  if (version) {
    // 继续执行导出
    exportDatabase();
  } else {
    console.error('无法获取数据库版本，导出终止');
    process.exit(1);
  }
}); 