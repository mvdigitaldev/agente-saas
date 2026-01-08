import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ImportServicesDto } from './dto/import-services.dto';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private supabase: SupabaseService) { }

  async findAll(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('services')
      .select('*, service_staff(staff_id)')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('Erro ao buscar serviços:', error);
      throw new BadRequestException('Erro ao buscar serviços');
    }

    // Transformar service_staff em staff_ids para facilitar o frontend
    const services = (data || []).map((service: any) => {
      const staff_ids = (service.service_staff as any[])?.map((s: any) => s.staff_id) || [];
      const { service_staff, ...rest } = service;
      return { ...rest, staff_ids };
    });

    return { services };
  }

  async findOne(empresaId: string, serviceId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('services')
      .select('*, service_staff(staff_id)')
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Serviço não encontrado');
    }

    // Transformar para retornar apenas IDs facilitando o frontend
    const staff_ids = (data.service_staff as any[])?.map(s => s.staff_id) || [];

    return { ...data, staff_ids };
  }

  async create(empresaId: string, createServiceDto: CreateServiceDto) {
    const db = this.supabase.getServiceRoleClient();

    // Migrar image_url para images se fornecido
    let images: string[] = createServiceDto.images || [];
    if (createServiceDto.image_url && !images.length) {
      images = [createServiceDto.image_url];
    }

    const serviceData: any = {
      empresa_id: empresaId,
      nome: createServiceDto.nome,
      descricao: createServiceDto.descricao || null,
      preco: createServiceDto.preco ? Number(createServiceDto.preco) : null,
      duracao_minutos: createServiceDto.duracao_minutos,
      image_url: createServiceDto.image_url || null, // Deprecated
      images: images.length > 0 ? images : null,
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

    // Associar colaboradores se fornecidos
    if (createServiceDto.staff_ids && createServiceDto.staff_ids.length > 0) {
      const associations = createServiceDto.staff_ids.map(staffId => ({
        service_id: data.service_id,
        staff_id: staffId,
        empresa_id: empresaId
      }));

      const { error: assocError } = await db
        .from('service_staff')
        .insert(associations);

      if (assocError) {
        this.logger.error('Erro ao associar colaboradores:', assocError);
        // Não lançaremos erro aqui para não desfazer a criação do serviço, 
        // mas em produção talvez devêssemos usar transação.
      }
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
    if (updateServiceDto.image_url !== undefined) updateData.image_url = updateServiceDto.image_url; // Deprecated
    if (updateServiceDto.images !== undefined) {
      updateData.images = updateServiceDto.images.length > 0 ? updateServiceDto.images : null;
    }
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

    // Sincronizar colaboradores se fornecidos
    if (updateServiceDto.staff_ids !== undefined) {
      // Remover associações existentes
      await db
        .from('service_staff')
        .delete()
        .eq('service_id', serviceId);

      // Adicionar novas se houver
      if (updateServiceDto.staff_ids && updateServiceDto.staff_ids.length > 0) {
        const associations = updateServiceDto.staff_ids.map(staffId => ({
          service_id: serviceId,
          staff_id: staffId,
          empresa_id: empresaId
        }));

        const { error: assocError } = await db
          .from('service_staff')
          .insert(associations);

        if (assocError) {
          this.logger.error('Erro ao sincronizar colaboradores:', assocError);
        }
      }
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

    if (!importServicesDto.services || importServicesDto.services.length === 0) {
      throw new BadRequestException('Nenhum serviço fornecido para importação');
    }

    let importados = 0;
    let erros = 0;
    const errosDetalhes: string[] = [];

    for (let i = 0; i < importServicesDto.services.length; i++) {
      const servicoData = importServicesDto.services[i];

      try {
        // Validar campos obrigatórios
        if (!servicoData.nome || !servicoData.duracao_minutos) {
          erros++;
          errosDetalhes.push(`Linha ${i + 1}: Nome e duração são obrigatórios`);
          continue;
        }

        if (servicoData.duracao_minutos <= 0) {
          erros++;
          errosDetalhes.push(`Linha ${i + 1}: Duração deve ser maior que zero`);
          continue;
        }

        // Migrar image_url para images se fornecido
        let images: string[] = servicoData.images || [];
        if (servicoData.image_url && !images.length) {
          images = [servicoData.image_url];
        }

        const dadosServico: any = {
          empresa_id: empresaId,
          nome: servicoData.nome.trim(),
          duracao_minutos: parseInt(servicoData.duracao_minutos.toString()),
          preco: servicoData.preco ? Number(servicoData.preco) : null,
          descricao: servicoData.descricao ? servicoData.descricao.trim() : null,
          image_url: servicoData.image_url || null, // Deprecated
          images: images.length > 0 ? images : null,
          ativo: servicoData.ativo ?? true,
          available_online: servicoData.available_online ?? true,
          show_price_online: servicoData.show_price_online ?? true,
          fixed_price: servicoData.fixed_price ?? true,
          created_by: null,
        };

        const { error: insertError } = await db
          .from('services')
          .insert(dadosServico)
          .select()
          .single();

        if (insertError) {
          erros++;
          errosDetalhes.push(`Linha ${i + 1}: ${insertError.message || 'Erro ao criar serviço'}`);
          continue;
        }

        importados++;
      } catch (error: any) {
        erros++;
        errosDetalhes.push(`Linha ${i + 1}: ${error.message || 'Erro desconhecido'}`);
      }
    }

    return {
      importados,
      erros,
      total: importServicesDto.services.length,
      errosDetalhes: erros > 0 ? errosDetalhes : undefined,
    };
  }

  /**
   * Adicionar imagem a um serviço
   */
  async addImage(empresaId: string, serviceId: string, imageUrl: string) {
    const db = this.supabase.getServiceRoleClient();
    const existing = await this.findOne(empresaId, serviceId);

    const currentImages = (existing.images as string[]) || [];
    if (currentImages.includes(imageUrl)) {
      throw new BadRequestException('Imagem já existe no serviço');
    }

    const updatedImages = [...currentImages, imageUrl];

    const { data, error } = await db
      .from('services')
      .update({ images: updatedImages })
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao adicionar imagem:', error);
      throw new BadRequestException('Erro ao adicionar imagem: ' + error.message);
    }

    return data;
  }

  /**
   * Remover imagem de um serviço
   */
  async removeImage(empresaId: string, serviceId: string, imageUrl: string) {
    const db = this.supabase.getServiceRoleClient();
    const existing = await this.findOne(empresaId, serviceId);

    const currentImages = (existing.images as string[]) || [];
    const updatedImages = currentImages.filter((url) => url !== imageUrl);

    const { data, error } = await db
      .from('services')
      .update({ images: updatedImages.length > 0 ? updatedImages : null })
      .eq('service_id', serviceId)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (error) {
      this.logger.error('Erro ao remover imagem:', error);
      throw new BadRequestException('Erro ao remover imagem: ' + error.message);
    }

    return data;
  }
}

