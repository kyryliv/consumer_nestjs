"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RABBITMQ_EVENT = exports.RABBITMQ_QUEUE = exports.RABBITMQ_URL = exports.RABBITMQ_SERVICE = void 0;
exports.RABBITMQ_SERVICE = 'RABBITMQ_SERVICE';
exports.RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
exports.RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE ?? 'main_queue';
exports.RABBITMQ_EVENT = 'demo_event';
//# sourceMappingURL=rabbitmq.constants.js.map