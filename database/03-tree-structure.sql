-- 数据库迁移：为 Todo 网站添加树形目录结构
-- 执行方式：mysql -u root -p todo_app < database/03-tree-structure.sql

-- 1. 将旧 tasks 表重命名备份（不改名也行，这里保留数据）
RENAME TABLE tasks TO tasks_old;

-- 2. 创建新的 items 表（统一存储目录和任务）
CREATE TABLE items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户',
    parent_id INT NULL COMMENT '父级ID，NULL表示根级',
    type ENUM('folder', 'task') NOT NULL DEFAULT 'task' COMMENT '类型：folder=目录，task=任务',
    title VARCHAR(255) NOT NULL COMMENT '标题（目录名/任务名）',
    content TEXT NULL COMMENT '任务内容（目录可为空）',
    notes TEXT NULL COMMENT '备注',
    due_date DATE NULL COMMENT '截止日期（仅任务有效）',
    completed TINYINT(1) DEFAULT 0 COMMENT '是否完成（仅任务有效）',
    sort_order INT DEFAULT 0 COMMENT '排序，数字越小越靠前',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='统一存储目录和任务';

-- 3. 从旧表迁移数据到新表
-- 旧 tasks → 新 items（type=task，title=content）
INSERT INTO items (user_id, parent_id, type, title, content, completed, created_at, updated_at)
SELECT user_id, NULL, 'task', content, content, completed, created_at, updated_at FROM tasks_old;
