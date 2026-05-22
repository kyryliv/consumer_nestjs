import { ProducerService } from './producer.service';
export declare class ProducerController {
    private readonly producerService;
    constructor(producerService: ProducerService);
    publish(body: {
        message?: string;
    }): Promise<{
        status: string;
        message: string;
    }>;
}
