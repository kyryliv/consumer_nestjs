import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ProducerService } from './producer.service';

@Controller('producer')
export class ProducerController {
  constructor(private readonly producerService: ProducerService) {}

  @Post('publish')
  async publish(@Body() body: { message?: string }) {
    const message = body?.message?.trim();

    if (!message) {
      throw new BadRequestException('message is required');
    }

    await firstValueFrom(this.producerService.publish(message));

    return {
      status: 'queued',
      message,
    };
  }
} 