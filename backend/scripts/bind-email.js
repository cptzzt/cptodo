const mysql = require('mysql2/promise');
require('dotenv').config();

async function bindEmail() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // 查看当前用户
    const [users] = await connection.execute('SELECT id, username FROM users');
    console.log('现有用户：', users);

    // 绑定邮箱到第一个用户（你可以根据需要修改）
    if (users.length > 0) {
      const targetUser = users[0];
      await connection.execute(
        'UPDATE users SET email = ? WHERE id = ?',
        ['chenlipeng2003@163.com', targetUser.id]
      );
      console.log(`✅ 已将邮箱 chenlipeng2003@163.com 绑定到用户 ${targetUser.username} (ID: ${targetUser.id})`);
    }
  } catch (err) {
    console.error('错误：', err);
  } finally {
    await connection.end();
  }
}

bindEmail();
