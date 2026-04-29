-- 迁移 07: 添加用户主题偏好字段
-- 说明: users 表添加 theme_preference 字段，存储用户选择的主题风格
-- 执行时间: 2026-04-28

USE todo_app;

-- 添加主题偏好字段，默认为 'forest-sage'
ALTER TABLE users
ADD COLUMN theme_preference VARCHAR(20) DEFAULT 'forest-sage'
COMMENT '用户主题偏好: forest-sage, warm-linen, lavender-mist, minimal-ink';

-- 为已存在的用户设置默认值
UPDATE users SET theme_preference = 'forest-sage' WHERE theme_preference IS NULL;
