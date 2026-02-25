// Email service utility using SMTP configuration from admin settings
// Note: Direct SMTP from browser is not secure. This service is designed
// to work with a backend proxy or simulate email sending in local mode.

import { adminApi } from '@/lib/api';

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email using the configured SMTP settings
 * In local mode, this simulates sending and logs the email
 * In production, this would call a backend email endpoint
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const config = await adminApi.getConfig();
  
  // Check if SMTP is configured
  if (!config.smtpHost || !config.smtpFrom) {
    console.warn('SMTP not configured. Email would be sent to:', options.to);
    console.log('Email subject:', options.subject);
    console.log('Email body:', options.body);
    
    // In local mode without SMTP, we simulate success
    // In production, you'd want to fail here
    return { success: true };
  }

  // If storage is remote, try to send via backend
  if (config.storage.type === 'remote' && config.storage.baseUrl) {
    try {
      // Import session token for authenticated requests
      const { getSessionToken } = await import('@/lib/api/sessionManager');
      const sessionToken = getSessionToken();
      
      const response = await fetch(`${config.storage.baseUrl}/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          to: options.to,
          subject: options.subject,
          body: options.body,
          html: options.html,
          smtp: {
            host: config.smtpHost,
            port: config.smtpPort,
            user: config.smtpUser,
            from: config.smtpFrom,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        return { success: false, error: error.error || 'Failed to send email' };
      }

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error while sending email' 
      };
    }
  }

  // Local mode with SMTP configured - log the email (would need backend to actually send)
  console.log('📧 Email would be sent via SMTP:');
  console.log('  From:', config.smtpFrom);
  console.log('  To:', options.to);
  console.log('  Subject:', options.subject);
  console.log('  Body:', options.body);
  
  return { success: true };
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
  email: string, 
  newPassword: string,
  userName?: string
): Promise<EmailResult> {
  const subject = 'Your Password Has Been Reset - SwimTrack';
  
  const body = `Hello${userName ? ` ${userName}` : ''},

Your password has been reset. Here is your new password:

${newPassword}

Please log in with this password and change it to something you'll remember.

If you did not request this password reset, please contact support immediately.

Best regards,
24swim.de Team`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .password-box { background: #fff; border: 2px solid #0ea5e9; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0; }
    .password { font-family: monospace; font-size: 24px; font-weight: bold; color: #0ea5e9; letter-spacing: 2px; }
    .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 20px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🏊 24swim.de</h1>
      <p>Password Reset</p>
    </div>
    <div class="content">
      <p>Hello${userName ? ` <strong>${userName}</strong>` : ''},</p>
      <p>Your password has been reset. Here is your new password:</p>
      
      <div class="password-box">
        <div class="password">${newPassword}</div>
      </div>
      
      <p>Please log in with this password and change it to something you'll remember.</p>
      
      <div class="warning">
        <strong>⚠️ Security Notice:</strong> If you did not request this password reset, please contact support immediately.
      </div>
    </div>
    <div class="footer">
      <p>24swim.de</p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: email,
    subject,
    body,
    html,
  });
}
