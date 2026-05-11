-- 添加"提前显示"字段：任务在截止日前每天出现在今天视图中
ALTER TABLE items ADD COLUMN show_early TINYINT(1) NOT NULL DEFAULT 0 AFTER shelved;
