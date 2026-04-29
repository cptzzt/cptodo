-- 用户名字段允许为空
-- 执行日期：2026-04-28
-- 说明：username 字段允许为 NULL，未设置用户名的用户只能用邮箱登录

-- 修改 username 字段允许 NULL
ALTER TABLE users
MODIFY COLUMN username VARCHAR(50) NULL COMMENT '用户名（可为空，未设置时只能用邮箱登录）';

-- 删除 username 的唯一索引（因为 NULL 不等于 NULL，多个 NULL 不会冲突）
-- 如果需要保持唯一性约束，会在应用层检查
