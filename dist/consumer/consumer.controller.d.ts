import { RmqContext } from '@nestjs/microservices';
import { ConsumerService } from './consumer.service';
export declare class ConsumerController {
    private readonly consumerService;
    constructor(consumerService: ConsumerService);
    handleShoporders(payload: {
        message: string;
        createdAt?: string;
    }, context: RmqContext): Promise<void>;
    handleEtc(payload: {
        message: string;
        createdAt?: string;
    }, context: RmqContext): void;
}
