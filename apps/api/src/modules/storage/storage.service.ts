import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly BUCKET_NAME = 'service-images';
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  constructor(private supabase: SupabaseService) {}

  /**
   * Upload de imagem para serviço
   * @param empresaId ID da empresa
   * @param file Arquivo de imagem
   * @param serviceId ID do serviço (opcional, para organizar por serviço)
   * @returns URL pública da imagem
   */
  async uploadServiceImage(
    empresaId: string,
    file: Express.Multer.File,
    serviceId?: string,
  ): Promise<string> {
    // Validar tipo de arquivo
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de arquivo não permitido. Apenas: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Validar tamanho
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `Arquivo muito grande. Tamanho máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Gerar nome único do arquivo
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extension = file.originalname.split('.').pop() || 'jpg';
    const fileName = serviceId
      ? `${empresaId}/${serviceId}/${timestamp}-${random}.${extension}`
      : `${empresaId}/${timestamp}-${random}.${extension}`;

    const storage = this.supabase.getServiceRoleClient().storage;

    // Verificar se bucket existe, criar se não existir
    const { data: buckets } = await storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.id === this.BUCKET_NAME);

    if (!bucketExists) {
      this.logger.log(`Criando bucket ${this.BUCKET_NAME}`);
      const { error: createError } = await storage.createBucket(this.BUCKET_NAME, {
        public: true,
        fileSizeLimit: this.MAX_FILE_SIZE,
        allowedMimeTypes: this.ALLOWED_MIME_TYPES,
      });

      if (createError) {
        this.logger.error(`Erro ao criar bucket: ${createError.message}`);
        throw new BadRequestException(`Erro ao criar bucket: ${createError.message}`);
      }
    }

    // Upload do arquivo
    const { data, error } = await storage
      .from(this.BUCKET_NAME)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erro ao fazer upload: ${error.message}`);
      throw new BadRequestException(`Erro ao fazer upload: ${error.message}`);
    }

    // Obter URL pública
    const {
      data: { publicUrl },
    } = storage.from(this.BUCKET_NAME).getPublicUrl(data.path);

    this.logger.log(`Imagem enviada com sucesso: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Deletar imagem do storage
   * @param imageUrl URL completa da imagem ou path relativo
   */
  async deleteServiceImage(imageUrl: string): Promise<void> {
    try {
      let filePath: string;

      // Se for URL completa, extrair path
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        const url = new URL(imageUrl);
        const pathParts = url.pathname.split('/').filter((p) => p);
        const bucketIndex = pathParts.findIndex((part) => part === this.BUCKET_NAME);
        
        if (bucketIndex === -1) {
          // Tentar extrair diretamente do pathname (formato: /storage/v1/object/public/bucket/path)
          const objectIndex = pathParts.findIndex((part) => part === 'object');
          if (objectIndex !== -1 && pathParts[objectIndex + 1] === 'public') {
            filePath = pathParts.slice(objectIndex + 3).join('/');
          } else {
            throw new BadRequestException('URL inválida: formato não reconhecido');
          }
        } else {
          filePath = pathParts.slice(bucketIndex + 1).join('/');
        }
      } else {
        // Já é um path relativo
        filePath = imageUrl;
      }

      const storage = this.supabase.getServiceRoleClient().storage;

      const { error } = await storage.from(this.BUCKET_NAME).remove([filePath]);

      if (error) {
        this.logger.error(`Erro ao deletar imagem: ${error.message}`);
        throw new BadRequestException(`Erro ao deletar imagem: ${error.message}`);
      }

      this.logger.log(`Imagem deletada com sucesso: ${filePath}`);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Erro ao processar URL: ${error.message}`);
      throw new BadRequestException(`Erro ao deletar imagem: ${error.message}`);
    }
  }
}

