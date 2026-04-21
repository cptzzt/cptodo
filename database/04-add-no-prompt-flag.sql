-- 为 users 表添加"删除带子项目录不再二次提示"字段
ALTER TABLE users ADD COLUMN no_child_delete_prompt TINYINT(1) DEFAULT 0 COMMENT '删除带子项目录时不再二次提示';
