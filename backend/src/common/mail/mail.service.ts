import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>(
      'MAIL_FROM',
      'TaskBoard <no-reply@localhost>',
    );
    this.transporter = host
      ? nodemailer.createTransport({
          host,
          port: config.get<number>('SMTP_PORT', 587),
          secure: config.get<string>('SMTP_SECURE') === 'true',
          auth: config.get<string>('SMTP_USER')
            ? {
                user: config.get<string>('SMTP_USER'),
                pass: config.get<string>('SMTP_PASSWORD'),
              }
            : undefined,
        })
      : null;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      if (this.config.get('NODE_ENV') === 'production') {
        throw new Error('SMTP_HOST is required to send transactional email');
      }
      this.logger.debug(`[mail disabled] ${to}: ${subject} — ${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
