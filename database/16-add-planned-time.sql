-- 16: items 表添加 planned_time 字段（预计完成时间，HH:mm 格式，用于"今天"视图排序）
ALTER TABLE items ADD COLUMN planned_time VARCHAR(5) DEFAULT NULL COMMENT '预计完成时间 HH:mm';
