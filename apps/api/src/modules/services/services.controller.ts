import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ImportServicesDto } from './dto/import-services.dto';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  create(
    @Query('empresa_id') empresaId: string,
    @Body() createServiceDto: CreateServiceDto,
  ) {
    return this.servicesService.create(empresaId, createServiceDto);
  }

  @Get()
  findAll(@Query('empresa_id') empresaId: string) {
    return this.servicesService.findAll(empresaId);
  }

  @Get(':id')
  findOne(@Query('empresa_id') empresaId: string, @Param('id') id: string) {
    return this.servicesService.findOne(empresaId, id);
  }

  @Patch(':id')
  update(
    @Query('empresa_id') empresaId: string,
    @Param('id') id: string,
    @Body() updateServiceDto: UpdateServiceDto,
  ) {
    return this.servicesService.update(empresaId, id, updateServiceDto);
  }

  @Delete(':id')
  remove(@Query('empresa_id') empresaId: string, @Param('id') id: string) {
    return this.servicesService.remove(empresaId, id);
  }

  @Post('import')
  importServices(
    @Query('empresa_id') empresaId: string,
    @Body() importServicesDto: ImportServicesDto,
  ) {
    return this.servicesService.importServices(empresaId, importServicesDto);
  }

  @Post(':id/images')
  addImage(
    @Query('empresa_id') empresaId: string,
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    return this.servicesService.addImage(empresaId, id, imageUrl);
  }

  @Delete(':id/images')
  removeImage(
    @Query('empresa_id') empresaId: string,
    @Param('id') id: string,
    @Body('image_url') imageUrl: string,
  ) {
    return this.servicesService.removeImage(empresaId, id, imageUrl);
  }
}

