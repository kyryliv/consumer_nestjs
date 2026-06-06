import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import { AppModule } from "./app.module";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? "amqp://rabbitmq:passworD@localhost:5672";
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE ?? "main_queue";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [RABBITMQ_URL],
      queue: RABBITMQ_QUEUE,
      wildcards: true,
      noAck: false,
      queueOptions: {
        durable: true,
      },
    },
  });

  await app.init();
  await app.startAllMicroservices();
}
bootstrap();
