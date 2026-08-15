import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly mailFrom: string;
  private readonly appUrl: string;
  private readonly isSmtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.getOrThrow<string>('SMTP_HOST');
    const port = Number(this.configService.getOrThrow<string>('SMTP_PORT'));
    const user = this.configService.get<string>('SMTP_USER') ?? '';
    const pass = this.configService.get<string>('SMTP_PASS') ?? '';

    this.mailFrom = this.configService.getOrThrow<string>('MAIL_FROM');
    this.appUrl = this.configService.getOrThrow<string>('APP_URL');
    this.isSmtpConfigured = Boolean(user && pass);

    this.transporter = this.isSmtpConfigured
      ? nodemailer.createTransport({
          host,
          port,
          auth: { user, pass },
        })
      : nodemailer.createTransport({ jsonTransport: true });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verifyUrl = `${this.appUrl}/auth/verify?token=${token}`;

    try {
      const info = await this.transporter.sendMail({
        from: this.mailFrom,
        to: email,
        subject: 'Verificá tu correo electrónico',
        text: `Hola,\n\nPara verificar tu cuenta abrí este enlace:\n${verifyUrl}\n\nSi no creaste esta cuenta, ignorá este mensaje.`,
        html: `
          <p>Hola,</p>
          <p>Para verificar tu cuenta hacé clic en el siguiente enlace:</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Si no creaste esta cuenta, ignorá este mensaje.</p>
        `,
      });

      if (!this.isSmtpConfigured)
        this.logger.warn(
          `SMTP not configured. Verification link for ${email}: ${verifyUrl}`,
        );
      else
        this.logger.log(`Verification email sent: ${info.messageId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${email}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
