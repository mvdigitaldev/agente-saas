import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UazapiService {
  private readonly baseUrl: string;
  private readonly masterKey?: string;
  private readonly webhookBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('UAZAPI_BASE_URL') || 'https://api.uazapi.com.br';
    this.masterKey = this.configService.get<string>('UAZAPI_MASTER_KEY');
    this.webhookBaseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || 'https://api-producao.com';
  }

  /**
   * Criar nova instância na Uazapi
   */
  async createInstance(instanceName: string, apikey?: string): Promise<{
    instance_id: string;
    apikey: string;
    qrcode?: string;
  }> {
    try {
      const url = `${this.baseUrl}/config`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.masterKey && { 'apikey': this.masterKey }),
        },
        body: JSON.stringify({
          instanceName,
          apikey: apikey || undefined, // Se não fornecido, Uazapi gera automaticamente
        }),
      });

      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignorar erro ao ler resposta
        }
        console.error(`Uazapi createInstance error: ${response.status} - ${errorText}`);
        throw new Error(`Uazapi error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.instance_id && !data.instanceName) {
        throw new Error('Resposta da Uazapi não contém instance_id');
      }
      
      return {
        instance_id: data.instance_id || data.instanceName || instanceName,
        apikey: data.apikey || apikey || '',
        qrcode: data.qrcode,
      };
    } catch (error: any) {
      console.error('Erro ao criar instância Uazapi:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao criar instância Uazapi: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Obter QR code para conexão
   */
  async getQrCode(instanceId: string, apikey: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/${instanceId}/qrcode`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': apikey,
        },
      });

      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignorar erro ao ler resposta
        }
        console.error(`Uazapi getQrCode error: ${response.status} - ${errorText}`);
        throw new Error(`Uazapi error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      // QR code pode vir como base64, URL ou objeto com qrcode
      if (typeof data === 'string') {
        return data;
      }
      if (data.qrcode) {
        return data.qrcode;
      }
      if (data.base64) {
        return `data:image/png;base64,${data.base64}`;
      }
      if (data.qr) {
        return data.qr;
      }
      
      console.error('Formato de QR code não reconhecido:', data);
      throw new Error('Formato de QR code não reconhecido');
    } catch (error: any) {
      console.error('Erro ao obter QR code:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao obter QR code: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Verificar status da conexão
   */
  async getInstanceStatus(instanceId: string, apikey: string): Promise<{
    status: string;
    connected: boolean;
    phone?: string;
  }> {
    try {
      const url = `${this.baseUrl}/${instanceId}/status`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': apikey,
        },
      });

      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignorar erro ao ler resposta
        }
        console.error(`Uazapi getInstanceStatus error: ${response.status} - ${errorText}`);
        throw new Error(`Uazapi error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      
      const connected = data.connected === true || data.status === 'connected' || data.status === 'CONNECTED';
      
      return {
        status: connected ? 'connected' : 'disconnected',
        connected,
        phone: data.phone || data.phoneNumber || data.number,
      };
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao verificar status: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Configurar webhook para a instância
   */
  async setWebhook(instanceId: string, apikey: string, webhookUrl: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/${instanceId}/config/webhook`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apikey,
        },
        body: JSON.stringify({
          webhookUrl,
        }),
      });

      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignorar erro ao ler resposta
        }
        console.error(`Uazapi setWebhook error: ${response.status} - ${errorText}`);
        throw new Error(`Uazapi error: ${response.status} - ${errorText}`);
      }
      
      console.log(`Webhook configurado com sucesso para instância ${instanceId}: ${webhookUrl}`);
    } catch (error: any) {
      console.error('Erro ao configurar webhook:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao configurar webhook: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Enviar mensagem de texto
   */
  async sendMessage(instanceId: string, apikey: string, phone: string, message: string, buttons?: Array<{ id: string; text: string }>): Promise<any> {
    try {
      const url = `${this.baseUrl}/${instanceId}/send-text`;
      
      const payload: any = {
        phone,
        message,
      };

      if (buttons && buttons.length > 0) {
        payload.buttons = buttons;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apikey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorText = 'Erro desconhecido';
        try {
          errorText = await response.text();
        } catch (e) {
          // Ignorar erro ao ler resposta
        }
        console.error(`Uazapi sendMessage error: ${response.status} - ${errorText}`);
        throw new Error(`Uazapi error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Erro ao enviar mensagem: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Gerar URL do webhook com instance_id
   */
  generateWebhookUrl(instanceId: string): string {
    return `${this.webhookBaseUrl}/webhook/uazapi?instance_id=${instanceId}`;
  }
}

