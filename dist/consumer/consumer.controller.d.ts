import { RmqContext } from '@nestjs/microservices';
export declare class ConsumerController {
    private readonly logger;
    handleMessage(payload: {
        message: string;
        createdAt?: string;
    }, context: RmqContext): void;
}
