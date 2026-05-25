import { Injectable, Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

@Injectable()
export class ConsumerService {
    private readonly logger = new Logger(ConsumerService.name);

    handleShoporders(
        payload: { message: string; createdAt?: string },
        context: RmqContext,
    ): void {
        const channel = context.getChannelRef();

        console.log(`Received message with routing key: ${context.getPattern()}`);

        let shoporders = JSON.parse(payload.message);

        const originalMessage = context.getMessage();
        channel.ack(originalMessage, context);
    }

    handleEtc(
        payload: { message: string; createdAt?: string },
        context: RmqContext,
    ): void {
        const channel = context.getChannelRef();

        console.log(`Received message with routing key: ${context.getPattern()}`);

        const originalMessage = context.getMessage();
        channel.ack(originalMessage, context);
    }
}