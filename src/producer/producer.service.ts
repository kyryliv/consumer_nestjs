import { Inject, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { RABBITMQ_EVENT, RABBITMQ_SERVICE } from '../rabbitmq.constants';

@Injectable()
export class ProducerService implements OnApplicationBootstrap {
  constructor(@Inject(RABBITMQ_SERVICE) private readonly client: ClientProxy) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.client.connect();
  }

  publish(message: string): Observable<unknown> {
    return this.client.emit(RABBITMQ_EVENT, {
      message,
      createdAt: new Date().toISOString(),
    });
  }
}