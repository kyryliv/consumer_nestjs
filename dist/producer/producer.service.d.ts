import { OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
export declare class ProducerService implements OnApplicationBootstrap {
    private readonly client;
    constructor(client: ClientProxy);
    onApplicationBootstrap(): Promise<void>;
    publish(message: string): Observable<unknown>;
}
