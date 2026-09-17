/*
 * 使用 MySQL 管理员账号单独执行本语句，不要与其他 SQL 一起批量执行。
 * 67108864 字节等于 64 MiB，也是 MySQL 8 常见的默认上限。
 * SET PERSIST 会立即修改全局值，并持久化到 mysqld-auto.cnf。
 * 执行后必须断开数据库连接并重新连接，再运行验证脚本。
 */
SET PERSIST max_allowed_packet = 67108864;
