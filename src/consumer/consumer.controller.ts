import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, MessagePattern, Payload, RmqContext } from '@nestjs/microservices';
import { ConsumerService } from './consumer.service';

@Controller()
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) { }

  @EventPattern('shoporders_event')
  handleShoporders(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): void {
    this.consumerService.handleShoporders(payload, context);
  }

  @EventPattern('*')
  handleEtc(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): void {
    this.consumerService.handleEtc(payload, context);
  }  
}
