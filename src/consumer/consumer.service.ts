import { Injectable, Logger } from '@nestjs/common';
import { RmqContext } from '@nestjs/microservices';

@Injectable()
export class ConsumerService {
    private readonly logger = new Logger(ConsumerService.name);

    async handleShoporders(
        payload: { message: string; createdAt?: string },
        context: RmqContext,
    ): Promise<void> {
        const channel = context.getChannelRef();
        const originalMessage = context.getMessage();

        this.logger.log(
            `Received message with routing key: ${String(context.getPattern())}`,
        );

        try {
            const shoporders = JSON.parse(payload.message);
            await this.sendToDrupal(shoporders);
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

    private async sendToDrupal(payload: unknown): Promise<void> {
        const drupalRestUrl = process.env.DRUPAL_REST_URL;
        const drupalJwtToken = process.env.DRUPAL_JWT_TOKEN;

        if (!drupalRestUrl) {
            throw new Error('DRUPAL_REST_URL is not configured');
        }

        if (!drupalJwtToken) {
            throw new Error('DRUPAL_JWT_TOKEN is not configured');
        }

        const response = await fetch(drupalRestUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${drupalJwtToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const responseBody = await response.text();
            throw new Error(
                `Drupal REST request failed with ${response.status}: ${responseBody}`,
            );
        }
    }
}