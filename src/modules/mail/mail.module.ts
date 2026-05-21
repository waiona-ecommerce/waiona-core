import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { MailService } from './services/mail.service';
import { MailProcessor } from './processors/mail.processor';
import { MAIL_QUEUE } from './mail.constants';

@Module({
  imports: [BullModule.registerQueue({ name: MAIL_QUEUE })],
  providers: [MailService, MailProcessor],
  exports: [MailService],
})
export class MailModule {}
