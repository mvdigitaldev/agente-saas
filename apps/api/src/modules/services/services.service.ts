import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ImportServicesDto } from './dto/import-services.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private supabase: SupabaseService) {}

  async findAll(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('services')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Erro ao buscar serviços:', error);
      throw new BadRequestException('Erro ao buscar serviços');
    }

    return { services: data || [] };
  }

  async findOne(empresaId: string, serviceId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('services')
      .select('*')
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Serviço não encontrado');
    }

    return data;
  }

  async create(empresaId: string, createServiceDto: CreateServiceDto) {
    const db = this.supabase.getServiceRoleClient();

    const serviceData: any = {
      empresa_id: empresaId,
      nome: createServiceDto.nome,
      descricao: createServiceDto.descricao || null,
      preco: createServiceDto.preco ? Number(createServiceDto.preco) : null,
      duracao_minutos: createServiceDto.duracao_minutos,
      image_url: createServiceDto.image_url || null,
      ativo: createServiceDto.ativo ?? true,
      available_online: createServiceDto.available_online ?? true,
      show_price_online: createServiceDto.show_price_online ?? true,
      fixed_price: createServiceDto.fixed_price ?? true,
    };

    // created_by será preenchido via trigger ou pode ser null

    const { data, error } = await db
      .from('services')
      .insert(serviceData)
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao criar serviço:', error);
      throw new BadRequestException('Erro ao criar serviço: ' + error.message);
    }

    return data;
  }

  async update(empresaId: string, serviceId: string, updateServiceDto: UpdateServiceDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o serviço existe e pertence à empresa
    const existing = await this.findOne(empresaId, serviceId);

    const updateData: any = {};
    if (updateServiceDto.nome !== undefined) updateData.nome = updateServiceDto.nome;
    if (updateServiceDto.descricao !== undefined) updateData.descricao = updateServiceDto.descricao;
    if (updateServiceDto.preco !== undefined) updateData.preco = updateServiceDto.preco ? Number(updateServiceDto.preco) : null;
    if (updateServiceDto.duracao_minutos !== undefined) updateData.duracao_minutos = updateServiceDto.duracao_minutos;
    if (updateServiceDto.image_url !== undefined) updateData.image_url = updateServiceDto.image_url;
    if (updateServiceDto.ativo !== undefined) updateData.ativo = updateServiceDto.ativo;
    if (updateServiceDto.available_online !== undefined) updateData.available_online = updateServiceDto.available_online;
    if (updateServiceDto.show_price_online !== undefined) updateData.show_price_online = updateServiceDto.show_price_online;
    if (updateServiceDto.fixed_price !== undefined) updateData.fixed_price = updateServiceDto.fixed_price;

    const { data, error } = await db
      .from('services')
      .update(updateData)
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao atualizar serviço:', error);
      throw new BadRequestException('Erro ao atualizar serviço: ' + error.message);
    }

    return data;
  }

  async remove(empresaId: string, serviceId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o serviço existe e pertence à empresa
    await this.findOne(empresaId, serviceId);

    const { error } = await db
      .from('services')
      .delete()
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId);

    if (error) {
      this.logger.error('Erro ao deletar serviço:', error);
      throw new BadRequestException('Erro ao deletar serviço: ' + error.message);
    }

    return { success: true };
  }

  async importServices(empresaId: string, importServicesDto: ImportServicesDto) {
    const db = this.supabase.getServiceRoleClient();

    const servicesToInsert = importServicesDto.services.map((service) => ({
      empresa_id: empresaId,
      nome: service.nome,
      descricao: service.descricao || null,
      preco: service.preco ? Number(service.preco) : null,
      duracao_minutos: service.duracao_minutos,
      image_url: service.image_url || null,
      ativo: service.ativo ?? true,
      available_online: service.available_online ?? true,
      show_price_online: service.show_price_online ?? true,
      fixed_price: service.fixed_price ?? true,
      created_by: null,
    }));

    const { data, error } = await db
      .from('services')
      .insert(servicesToInsert)
      .select();

    if (error) {
      this.logger.error('Erro ao importar serviços:', error);
      throw new BadRequestException('Erro ao importar serviços: ' + error.message);
    }

    return {
      imported: data?.length || 0,
      services: data || [],
    };
  }
}

