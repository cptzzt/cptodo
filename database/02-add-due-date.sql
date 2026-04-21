-- 数据库迁移：为 tasks 表添加截止日期字段
-- 执行方式：mysql -u root -p todo_app < database/02-add-due-date.sql

ALTER TABLE tasks
ADD COLUMN due_date DATE NULL COMMENT '截止日期，格式：YYYY-MM-DD'
AFTER content;
