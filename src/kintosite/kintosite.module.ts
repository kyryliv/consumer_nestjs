import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { KintoAuthService } from './kintosite.auth.service';
import { KintositeService } from './kintosite.service';

@Module({
  imports: [HttpModule],
  providers: [KintoAuthService, KintositeService],
  exports: [KintositeService],
})
export class KintoModule {}
