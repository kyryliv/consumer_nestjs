import { Injectable, Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';
import { KintositeService } from '../kintosite/kintosite.service';

@Injectable()
export class ConsumerService {
    private readonly logger = new Logger(ConsumerService.name);

    constructor(private readonly kintositeService: KintositeService) {}

    async handleFundsListUpdate(
        payload: { message: string },
        context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMessage = context.getMessage();

        try {
            const fundsList = JSON.parse(payload.message);
            await this.kintositeService.executeById(
                'funds_list.update',
                fundsList,
            );
            channel.ack(originalMessage);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to forward funds list payload: ${message}`);
            channel.nack(originalMessage, false, true);
        }
    }

    async handleShopordersUpdate(
        payload: { message: string },
        context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMessage = context.getMessage();

        try {
            const shoporders = JSON.parse(payload.message);
            await this.kintositeService.executeById(
                'shoporders.update',
                shoporders,
            );
        channel.ack(originalMessage);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(`Failed to forward shoporders payload: ${message}`);
            channel.nack(originalMessage, false, true);
        }
    }

    handleEtc(
        payload: { message: string; createdAt?: string },
        context: RmqContext,
    ): void {
        const channel = context.getChannelRef();

        this.logger.log(
            `Received message with routing key: ${String(context.getPattern())}`,
        );

        const originalMessage = context.getMessage();
        channel.ack(originalMessage);
    }
}