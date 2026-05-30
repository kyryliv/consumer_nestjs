import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { KintositeAuthService } from './kintosite.auth.service';
import { KintositeService } from './kintosite.service';

@Module({
  imports: [HttpModule],
  providers: [KintositeAuthService, KintositeService],
  exports: [KintositeService],
})
export class KintositeModule {}
