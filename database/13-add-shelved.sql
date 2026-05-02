-- 添加"搁置"字段：暂时从视野中隐藏的任务
ALTER TABLE items ADD COLUMN shelved TINYINT(1) NOT NULL DEFAULT 0 AFTER is_private;
