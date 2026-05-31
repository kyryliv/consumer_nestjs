import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConsumerModule } from './consumer/consumer.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ConsumerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
