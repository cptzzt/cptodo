-- 项目专属标签表
-- 每个项目可以有自己的标签集合，任务最多绑定 1 个项目专属标签

CREATE TABLE project_labels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(7) DEFAULT '#4f46e5',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_project_label (project_id, name)
);

-- items 表加 project_label_id 字段
ALTER TABLE items ADD COLUMN project_label_id INT NULL AFTER project_id;
ALTER TABLE items ADD FOREIGN KEY (project_label_id) REFERENCES project_labels(id) ON DELETE SET NULL;
