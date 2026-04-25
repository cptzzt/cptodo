-- 数据库迁移：软删除支持（回收站功能）
-- 执行方式：DBeaver 中逐段执行
-- 日期：2026-04-24

-- ============================================================
-- 1. items 表添加 deleted_at 字段
-- ============================================================
ALTER TABLE items
    ADD COLUMN deleted_at TIMESTAMP NULL COMMENT '软删除时间，NULL=正常，有值=在回收站' AFTER updated_at;

-- 为软删除查询加索引
ALTER TABLE items
    ADD INDEX idx_items_deleted (user_id, deleted_at);

-- ============================================================
-- 2. projects 表添加 deleted_at 字段
-- ============================================================
ALTER TABLE projects
    ADD COLUMN deleted_at TIMESTAMP NULL COMMENT '软删除时间，NULL=正常，有值=在回收站' AFTER created_at;

-- 为软删除查询加索引
ALTER TABLE projects
    ADD INDEX idx_projects_deleted (user_id, deleted_at);
