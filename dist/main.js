"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const core_1 = require("@nestjs/core");
const microservices_1 = require("@nestjs/microservices");
const app_module_1 = require("./app.module");
const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://rabbitmq:passworD@localhost:5672';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE ?? 'main_queue';
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.connectMicroservice({
        transport: microservices_1.Transport.RMQ,
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
    await app.startAllMicroservices();
}
bootstrap();
//# sourceMappingURL=main.js.map