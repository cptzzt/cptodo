-- 数据库迁移：引入项目、标签、随笔、重复任务
-- 执行方式：DBeaver 中逐段执行
-- 日期：2026-04-22

-- ============================================================
-- 1. 新建 projects 表
-- ============================================================
CREATE TABLE projects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户',
    name VARCHAR(100) NOT NULL COMMENT '项目名称',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='项目表';

-- ============================================================
-- 2. 新建 tags 表（全局标签，跨项目）
-- ============================================================
CREATE TABLE tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL COMMENT '所属用户',
    name VARCHAR(50) NOT NULL COMMENT '标签名称',
    color VARCHAR(7) DEFAULT '#4f46e5' COMMENT '标签颜色（十六进制）',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uk_user_tag (user_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';

-- ============================================================
-- 3. 新建 item_tags 关联表
-- ============================================================
CREATE TABLE item_tags (
    item_id INT NOT NULL,
    tag_id INT NOT NULL,
    PRIMARY KEY (item_id, tag_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务-标签关联表';

-- ============================================================
-- 4. 改造 items 表：新增字段
-- ============================================================
ALTER TABLE items
    ADD COLUMN project_id INT NULL COMMENT '所属项目，NULL=随笔' AFTER user_id,
    ADD COLUMN priority ENUM('normal', 'important') DEFAULT 'normal' COMMENT '优先级' AFTER completed,
    ADD COLUMN recurring ENUM('daily', 'weekly', 'monthly') NULL COMMENT '重复周期' AFTER priority;

-- 添加外键
ALTER TABLE items
    ADD CONSTRAINT fk_items_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- 修改 type 枚举，加入 'note' 类型（随笔）
ALTER TABLE items MODIFY COLUMN type ENUM('note', 'folder', 'task') NOT NULL DEFAULT 'task' COMMENT '类型：note=随笔，folder=目录，task=任务';

-- ============================================================
-- 5. 迁移现有数据：为每个用户创建默认项目，将现有 items 归入
-- ============================================================
INSERT INTO projects (user_id, name, sort_order)
SELECT id, '默认项目', 0 FROM users;

-- 将现有 items（有 parent_id 关系的）归入对应用户的默认项目
UPDATE items i
JOIN (
    -- 找到每个 item 的根祖先的 user_id（其实就是自己的 user_id）
    SELECT id, user_id FROM items
) root ON i.user_id = root.user_id
JOIN projects p ON p.user_id = i.user_id AND p.name = '默认项目'
SET i.project_id = p.id
WHERE i.project_id IS NULL AND i.type IN ('folder', 'task');
