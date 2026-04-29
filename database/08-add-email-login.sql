-- 邮箱登录注册功能
-- 执行日期：2026-04-28
-- 说明：新增 email 字段到 users 表，新增 verification_codes 表存储验证码

-- 1. 给 users 表新增 email 字段
ALTER TABLE users
ADD COLUMN email VARCHAR(255) UNIQUE NULL COMMENT '邮箱地址',
ADD INDEX idx_email (email);

-- 2. 创建验证码表
CREATE TABLE verification_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL COMMENT '邮箱地址',
  code VARCHAR(6) NOT NULL COMMENT '6位验证码',
  type ENUM('login', 'register') NOT NULL DEFAULT 'login' COMMENT '类型：login=登录，register=注册',
  used TINYINT(1) DEFAULT 0 COMMENT '是否已使用（0=未使用，1=已使用）',
  expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_type (email, type),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱验证码表';
