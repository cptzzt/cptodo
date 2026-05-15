-- 15: 添加 original_created_at 字段，记录重复任务的首次创建日期
-- 每次重复任务重建时，将旧任务的创建日期（或 original_created_at）复制到新任务

ALTER TABLE items ADD COLUMN original_created_at DATETIME DEFAULT NULL;

-- 回填：现有重复任务还没有 original_created_at，把它们的 created_at 作为初始创建日期
UPDATE items SET original_created_at = created_at WHERE recurring IS NOT NULL AND original_created_at IS NULL;
