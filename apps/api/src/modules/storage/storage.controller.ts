import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';

@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  /**
   * Upload de imagem para serviço
   * POST /storage/services/upload
   */
  @Post('services/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadServiceImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('empresa_id') empresaId: string,
    @Body('service_id') serviceId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }

    if (!empresaId) {
      throw new BadRequestException('empresa_id é obrigatório');
    }

    const imageUrl = await this.storageService.uploadServiceImage(
      empresaId,
      file,
      serviceId,
    );

    return {
      success: true,
      image_url: imageUrl,
    };
  }

  /**
   * Deletar imagem do storage
   * DELETE /storage/services/:imageUrl
   */
  @Delete('services')
  async deleteServiceImage(@Body('image_url') imageUrl: string) {
    if (!imageUrl) {
      throw new BadRequestException('image_url é obrigatório');
    }

    await this.storageService.deleteServiceImage(imageUrl);

    return {
      success: true,
      message: 'Imagem deletada com sucesso',
    };
  }
}

