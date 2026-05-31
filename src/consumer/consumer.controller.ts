import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ConsumerService } from './consumer.service';

@Controller()
export class ConsumerController {
  constructor(private readonly consumerService: ConsumerService) { }

  @EventPattern('shoporders_event')
  async handleShoporders(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.consumerService.handleShopordersUpdate(payload, context);
  }

  @EventPattern('funds_list_event')
  async handleFundsList(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): Promise<void> {
    await this.consumerService.handleFundsListUpdate(payload, context);
  }

  @EventPattern('*')
  handleEtc(
    @Payload() payload: { message: string; createdAt?: string },
    @Ctx() context: RmqContext,
  ): void {
    this.consumerService.handleEtc(payload, context);
  }  
}
