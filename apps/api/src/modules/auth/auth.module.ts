import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../../database/database.module';
import { EmpresasModule } from '../empresas/empresas.module';

@Module({
  imports: [DatabaseModule, EmpresasModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

