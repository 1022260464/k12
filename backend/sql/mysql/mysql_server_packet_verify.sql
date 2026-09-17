/*
 * 修改 max_allowed_packet 后，新建数据库连接并单独执行本语句。
 * 两列都应为 67108864；旧连接的 session_bytes 可能仍然是 2048。
 */
SELECT
    @@GLOBAL.max_allowed_packet AS global_bytes,
    @@SESSION.max_allowed_packet AS session_bytes;
