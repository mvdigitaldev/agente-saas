import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { SupabaseService } from '../../database/supabase.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ImportClientsDto } from './dto/import-clients.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private supabase: SupabaseService) {}

  /**
   * Normaliza o número de WhatsApp removendo formatação
   */
  private normalizeWhatsAppNumber(phone: string): string {
    if (!phone) return '';
    // Remove todos os caracteres não numéricos
    return phone.replace(/\D/g, '');
  }

  /**
   * Lista todos os clientes de uma empresa
   */
  async listClients(empresaId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('clients')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });

    if (error) {
      this.logger.error(`Erro ao listar clientes: ${error.message}`);
      throw new BadRequestException(`Erro ao listar clientes: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Busca um cliente por ID
   */
  async getClient(empresaId: string, clientId: string) {
    const db = this.supabase.getServiceRoleClient();

    const { data, error } = await db
      .from('clients')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('client_id', clientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException(`Cliente não encontrado: ${clientId}`);
      }
      this.logger.error(`Erro ao buscar cliente: ${error.message}`);
      throw new BadRequestException(`Erro ao buscar cliente: ${error.message}`);
    }

    return data;
  }

  /**
   * Cria um novo cliente
   */
  async createClient(empresaId: string, createClientDto: CreateClientDto) {
    const db = this.supabase.getServiceRoleClient();

    // Normalizar whatsapp_number
    const normalizedPhone = this.normalizeWhatsAppNumber(createClientDto.whatsapp_number);

    if (!normalizedPhone) {
      throw new BadRequestException('whatsapp_number é obrigatório e deve conter pelo menos um dígito');
    }

    // Verificar se já existe cliente com o mesmo whatsapp_number na empresa
    const { data: existing } = await db
      .from('clients')
      .select('client_id')
      .eq('empresa_id', empresaId)
      .eq('whatsapp_number', normalizedPhone)
      .single();

    if (existing) {
      throw new BadRequestException(
        `Já existe um cliente com o número ${normalizedPhone} nesta empresa`,
      );
    }

    const { data, error } = await db
      .from('clients')
      .insert({
        empresa_id: empresaId,
        nome: createClientDto.nome.trim(),
        whatsapp_number: normalizedPhone,
        email: createClientDto.email?.trim() || null,
      })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Erro ao criar cliente: ${error.message}`);
      throw new BadRequestException(`Erro ao criar cliente: ${error.message}`);
    }

    return data;
  }

  /**
   * Atualiza um cliente existente
   */
  async updateClient(empresaId: string, clientId: string, updateClientDto: UpdateClientDto) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o cliente existe
    await this.getClient(empresaId, clientId);

    const updateData: any = {};

    if (updateClientDto.nome !== undefined) {
      updateData.nome = updateClientDto.nome.trim();
    }

    if (updateClientDto.whatsapp_number !== undefined) {
      const normalizedPhone = this.normalizeWhatsAppNumber(updateClientDto.whatsapp_number);

      if (!normalizedPhone) {
        throw new BadRequestException('whatsapp_number deve conter pelo menos um dígito');
      }

      // Verificar se já existe outro cliente com o mesmo whatsapp_number na empresa
      const { data: existing } = await db
        .from('clients')
        .select('client_id')
        .eq('empresa_id', empresaId)
        .eq('whatsapp_number', normalizedPhone)
        .neq('client_id', clientId)
        .single();

      if (existing) {
        throw new BadRequestException(
          `Já existe outro cliente com o número ${normalizedPhone} nesta empresa`,
        );
      }

      updateData.whatsapp_number = normalizedPhone;
    }

    if (updateClientDto.email !== undefined) {
      updateData.email = updateClientDto.email?.trim() || null;
    }

    const { data, error } = await db
      .from('clients')
      .update(updateData)
      .eq('empresa_id', empresaId)
      .eq('client_id', clientId)
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Erro ao atualizar cliente: ${error.message}`);
      throw new BadRequestException(`Erro ao atualizar cliente: ${error.message}`);
    }

    return data;
  }

  /**
   * Exclui um cliente
   */
  async deleteClient(empresaId: string, clientId: string) {
    const db = this.supabase.getServiceRoleClient();

    // Verificar se o cliente existe
    await this.getClient(empresaId, clientId);

    const { error } = await db
      .from('clients')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('client_id', clientId);

    if (error) {
      this.logger.error(`Erro ao excluir cliente: ${error.message}`);
      throw new BadRequestException(`Erro ao excluir cliente: ${error.message}`);
    }

    return { success: true };
  }

  /**
   * Importa clientes em lote
   */
  async importClients(empresaId: string, importClientsDto: ImportClientsDto) {
    const db = this.supabase.getServiceRoleClient();

    const results = {
      imported: 0,
      errors: 0,
      errorDetails: [] as Array<{ index: number; error: string }>,
    };

    for (let i = 0; i < importClientsDto.clients.length; i++) {
      const clientDto = importClientsDto.clients[i];

      try {
        // Normalizar whatsapp_number
        const normalizedPhone = this.normalizeWhatsAppNumber(clientDto.whatsapp_number);

        if (!normalizedPhone) {
          results.errors++;
          results.errorDetails.push({
            index: i,
            error: 'whatsapp_number inválido ou vazio',
          });
          continue;
        }

        // Verificar se já existe cliente com o mesmo whatsapp_number
        const { data: existing } = await db
          .from('clients')
          .select('client_id')
          .eq('empresa_id', empresaId)
          .eq('whatsapp_number', normalizedPhone)
          .single();

        if (existing) {
          // Cliente já existe, pular
          continue;
        }

        // Criar cliente
        const { error } = await db.from('clients').insert({
          empresa_id: empresaId,
          nome: clientDto.nome.trim(),
          whatsapp_number: normalizedPhone,
          email: clientDto.email?.trim() || null,
        });

        if (error) {
          results.errors++;
          results.errorDetails.push({
            index: i,
            error: error.message,
          });
        } else {
          results.imported++;
        }
      } catch (error: any) {
        results.errors++;
        results.errorDetails.push({
          index: i,
          error: error.message || 'Erro desconhecido',
        });
      }
    }

    return results;
  }
}

