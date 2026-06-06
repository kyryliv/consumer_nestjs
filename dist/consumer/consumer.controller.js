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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumerController = void 0;
const common_1 = require("@nestjs/common");
const microservices_1 = require("@nestjs/microservices");
const consumer_service_1 = require("./consumer.service");
let ConsumerController = class ConsumerController {
    consumerService;
    constructor(consumerService) {
        this.consumerService = consumerService;
    }
    async handleShoporders(payload, context) {
        await this.consumerService.handleShopordersUpdate(payload, context);
    }
    async handleFundsList(payload, context) {
        await this.consumerService.handleFundsListUpdate(payload, context);
    }
    handleEtc(payload, context) {
        this.consumerService.handleEtc(payload, context);
    }
};
exports.ConsumerController = ConsumerController;
__decorate([
    (0, microservices_1.EventPattern)("shoporders_event"),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.RmqContext]),
    __metadata("design:returntype", Promise)
], ConsumerController.prototype, "handleShoporders", null);
__decorate([
    (0, microservices_1.EventPattern)("funds_list_event"),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.RmqContext]),
    __metadata("design:returntype", Promise)
], ConsumerController.prototype, "handleFundsList", null);
__decorate([
    (0, microservices_1.EventPattern)("*"),
    __param(0, (0, microservices_1.Payload)()),
    __param(1, (0, microservices_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, microservices_1.RmqContext]),
    __metadata("design:returntype", void 0)
], ConsumerController.prototype, "handleEtc", null);
exports.ConsumerController = ConsumerController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [consumer_service_1.ConsumerService])
], ConsumerController);
//# sourceMappingURL=consumer.controller.js.map