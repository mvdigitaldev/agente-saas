import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmpresasService } from './empresas.service';
import { CreateEmpresaDto } from './dto/create-empresa.dto';

@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresasService: EmpresasService) {}

  @Get(':id')
  async getEmpresa(@Body('id') id: string) {
    return this.empresasService.getEmpresa(id);
  }

  @Post()
  async createEmpresa(@Body() dto: CreateEmpresaDto) {
    return this.empresasService.createEmpresa(dto);
  }
}

