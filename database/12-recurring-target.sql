-- 重复任务添加频次目标字段
-- 执行日期：(待填)
-- 说明：recurring_target=1 为原有行为（每天/每周固定日期）
--       recurring_target>1 为频次目标（如每周 N 次），无具体日期，只展示在"本周"视图

ALTER TABLE items
  ADD COLUMN recurring_target INT NOT NULL DEFAULT 1 COMMENT '重复任务频次目标（1=固定日期，>1=每周N次）'
  AFTER recurring;

ALTER TABLE items
  ADD COLUMN recurring_count INT NOT NULL DEFAULT 0 COMMENT '重复任务本周已完成次数'
  AFTER recurring_target;
