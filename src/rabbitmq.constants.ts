export const RABBITMQ_SERVICE = 'RABBITMQ_SERVICE';
export const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
export const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE ?? 'main_queue';
export const RABBITMQ_EVENT = 'demo_event';