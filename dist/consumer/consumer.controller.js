"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ConsumerController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const rabbitmq_constants_1 = require("../rabbitmq.constants");
let ConsumerController = ConsumerController_1 = class ConsumerController {
    logger = new common_1.Logger(ConsumerController_1.name);
    handleMessage(payload, context) {
        this.logger.log(`Received message: ${payload.message}`);
        const channel = context.getChannelRef();
        const originalMessage = context.getMessage();
        channel.ack(originalMessage);
    }
};
exports.ConsumerController = ConsumerController;
__decorate([
    (0, microservices_1.EventPattern)(rabbitmq_constants_1.RABBITMQ_EVENT),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.RmqContext]),
    __metadata("design:returntype", void 0)
], ConsumerController.prototype, "handleMessage", null);
exports.ConsumerController = ConsumerController = ConsumerController_1 = __decorate([
    (0, common_1.Controller)()
], ConsumerController);
//# sourceMappingURL=consumer.controller.js.map