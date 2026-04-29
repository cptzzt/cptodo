const nodemailer = require('nodemailer');
require('dotenv').config();

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * 发送验证码邮件
 * @param {string} to - 收件人邮箱
 * @param {string} code - 6位验证码
 * @param {string} type - 类型：login=登录，register=注册
 */
async function sendVerificationCode(to, code, type = 'login') {
  const typeText = type === 'register' ? '注册' : '登录';
  const subject = `CPTodo ${typeText}验证码`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
      <div style="background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #333; margin-top: 0;">CPTodo ${typeText}验证码</h2>
        <p style="color: #666; font-size: 16px;">您好，</p>
        <p style="color: #666; font-size: 16px;">您正在进行 CPTodo ${typeText}操作，验证码如下：</p>
        <div style="background-color: #f0f0f0; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 5px; border-radius: 4px; margin: 20px 0;">
          ${code}
        </div>
        <p style="color: #666; font-size: 14px;">验证码有效期为 5 分钟，请尽快完成验证。</p>
        <p style="color: #999; font-size: 12px;">如果这不是您的操作，请忽略此邮件。</p>
      </div>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });
    console.log('邮件发送成功：', info.messageId);
    return true;
  } catch (error) {
    console.error('邮件发送失败：', error);
    throw new Error('邮件发送失败，请稍后重试');
  }
}

module.exports = { sendVerificationCode };
