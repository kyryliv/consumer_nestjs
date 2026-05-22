import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { RABBITMQ_EVENT } from '../rabbitmq.constants';

@Controller()
export class ConsumerController {
  private readonly logger = new Logger(ConsumerController.name);

  @EventPattern(RABBITMQ_EVENT)
  handleMessage(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): void {
    this.logger.log(`Received message: ${payload.message}`);

    const channel = context.getChannelRef();
    const originalMessage = context.getMessage();
    channel.ack(originalMessage);
  }
}