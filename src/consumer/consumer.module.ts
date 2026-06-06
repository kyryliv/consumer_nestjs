import { Module } from "@nestjs/common";
import { KintositeModule } from "../kintosite/kintosite.module";
import { ConsumerController } from "./consumer.controller";
import { ConsumerService } from "./consumer.service";

@Module({
  imports: [KintositeModule],
  controllers: [ConsumerController],
  providers: [ConsumerService],
})
export class ConsumerModule {}
