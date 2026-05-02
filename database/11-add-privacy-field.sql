-- 添加隐私字段到项目、标签、任务表
-- 执行日期：2026-04-30
-- 说明：is_private=1 表示隐私项目/标签/任务，在隐私模式下隐藏

-- 项目表加 is_private 字段
ALTER TABLE projects ADD COLUMN is_private TINYINT(1) DEFAULT 0 NOT NULL COMMENT '是否隐私（0=正常，1=隐私）';

-- 标签表加 is_private 字段
ALTER TABLE tags ADD COLUMN is_private TINYINT(1) DEFAULT 0 NOT NULL COMMENT '是否隐私（0=正常，1=隐私）';

-- 任务表加 is_private 字段
ALTER TABLE items ADD COLUMN is_private TINYINT(1) DEFAULT 0 NOT NULL COMMENT '是否隐私（0=正常，1=隐私）';
