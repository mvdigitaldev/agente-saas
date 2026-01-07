import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface InitInstanceResponse {
  response: string;
  instance: {
    id: string;
    token: string;
    status: string; // Sempre "disconnected" quando criada
    paircode?: string;
    qrcode?: string; // Não vem no init, só no connect
    name: string;
    profileName?: string;
    profilePicUrl?: string;
    isBusiness?: boolean;
    plataform?: string;
    systemName?: string;
    owner?: string;
    lastDisconnect?: string;
    lastDisconnectReason?: string;
    created: string;
    updated: string;
    currentPresence?: string;
  };
  connected: boolean; // Sempre false quando criada
  loggedIn: boolean; // Sempre false quando criada
  name: string;
  token: string;
  info?: string;
}

export interface InstanceStatusResponse {
  instance: {
    id: string;
    token: string;
    status: string; // 'disconnected' | 'connecting' | 'connected'
    qrcode?: string;
    name: string;
    profileName?: string; // Nome do perfil WhatsApp (não é o número)
    connected?: boolean; // Pode estar aqui também
    loggedIn?: boolean; // Pode estar aqui também
  };
  status?: {
    // Status no root da resposta (conforme documentação)
    connected: boolean;
    loggedIn: boolean;
    jid?: {
      user: string; // Número de telefone quando conectado (ex: '5511999999999' - SEM @s.whatsapp.net)
      agent: number;
      device: number;
      server: string;
    } | string | null; // Pode vir como objeto ou string (ex: "554197429568:59@s.whatsapp.net")
  };
}

export interface ConnectInstanceResponse {
  connected: boolean;
  loggedIn: boolean;
  jid?: {
    user: string;
    agent: number;
    device: number;
    server: string;
  } | null;
  instance: {
    id: string;
    token: string;
    status: string;
    paircode?: string;
    qrcode?: string; // QR Code gerado quando phone não é informado
    name: string;
    profileName?: string; // Nome do perfil WhatsApp (não é o número)
    connected: boolean;
    loggedIn: boolean;
    plataform?: string; // Plataforma (iOS/Android/Web)
    systemName?: string; // Nome do sistema operacional
  };
}

@Injectable()
export class UazapiService {
  private readonly logger = new Logger(UazapiService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly adminToken: string;
  private readonly webhookBaseUrl: string;

  constructor(private configService: ConfigService) {
    const baseUrl = this.configService.get<string>('UAZAPI_BASE_URL') || 'https://iagenda.uazapi.com';
    this.adminToken = this.configService.get<string>('UAZAPI_ADMIN_TOKEN') || '';
    this.webhookBaseUrl = this.configService.get<string>('WEBHOOK_BASE_URL') || 'https://api-producao.com';

    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Baixa mídia de uma mensagem
   * Endpoint: POST /message/download
   * @param messageId ID da mensagem
   * @param token Token da instância
   * @returns Buffer do arquivo
   */
  async downloadMedia(messageId: string, token: string): Promise<Buffer> {
    try {
      this.logger.log(`Baixando mídia da mensagem: ${messageId}`);

      const response = await this.axiosInstance.post(
        '/message/download',
        {
          id: messageId,
          return_base64: false, // Queremos o buffer binário
        },
        {
          headers: {
            token,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer', // Importante para receber binário
        },
      );

      return Buffer.from(response.data);
    } catch (error: any) {
      this.logger.error(`Erro ao baixar mídia: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao baixar mídia: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao baixar mídia: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cria uma nova instância no Uazapi
   * Documentação: https://docs.uazapi.com/
   * Endpoint: POST /instance/init
   * Header: admintoken (UAZAPI_ADMIN_TOKEN)
   * @param name Nome da instância (baseado em razao_social sanitizado)
   * @returns Resposta com dados da instância incluindo token
   */
  async initInstance(name: string): Promise<InitInstanceResponse> {
    try {
      if (!this.adminToken) {
        throw new HttpException(
          'UAZAPI_ADMIN_TOKEN não configurado',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      this.logger.log(`Criando instância Uazapi: ${name}`);

      const response = await this.axiosInstance.post<InitInstanceResponse>(
        '/instance/init',
        { name },
        {
          headers: {
            admintoken: this.adminToken,
          },
        },
      );

      this.logger.log(
        `Instância criada com sucesso: ${response.data.instance?.id}`,
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Erro ao criar instância Uazapi: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao criar instância: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao criar instância: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Conecta uma instância ao WhatsApp
   * Documentação: https://docs.uazapi.com/
   * Endpoint: POST /instance/connect
   * Header: token (instance token)
   * Nota: Se phone não for informado, gera QR code. Se informado, gera código de pareamento.
   * @param token Token da instância
   * @param phone Número de telefone (opcional - se não informado, gera QR code)
   * @returns Resposta com QR code (se phone não informado) ou código de pareamento
   * @throws HttpException com status 404 se a instância não existir no Uazapi
   */
  async connectInstance(token: string, phone?: string): Promise<ConnectInstanceResponse> {
    try {
      this.logger.log(`Conectando instância${phone ? ` via número: ${phone}` : ' (gerando QR code)'}`);

      const response = await this.axiosInstance.post<ConnectInstanceResponse>(
        '/instance/connect',
        phone ? { phone } : {},
        {
          headers: {
            token,
          },
        },
      );

      this.logger.log('Instância conectada com sucesso');
      return response.data;
    } catch (error: any) {
      this.logger.error(`Erro ao conectar instância: ${error.message}`, error.stack);
      if (error.response) {
        const status = error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
        // Preservar status 404 para que o caller possa detectar instância inexistente
        throw new HttpException(
          `Erro ao conectar instância: ${error.response.data?.message || error.message}`,
          status,
        );
      }
      throw new HttpException(
        `Erro ao conectar instância: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Desconecta uma instância
   * Documentação: https://docs.uazapi.com/
   * Endpoint: POST /instance/disconnect
   * Header: token (instance token)
   * @param token Token da instância
   */
  async disconnectInstance(token: string): Promise<void> {
    try {
      this.logger.log('Desconectando instância');

      await this.axiosInstance.post(
        '/instance/disconnect',
        {},
        {
          headers: {
            token,
          },
        },
      );

      this.logger.log('Instância desconectada com sucesso');
    } catch (error: any) {
      this.logger.error(`Erro ao desconectar instância: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao desconectar instância: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao desconectar instância: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verifica status de uma instância
   * Documentação: https://docs.uazapi.com/
   * Endpoint: GET /instance/status
   * Header: token (instance token)
   * @param token Token da instância
   * @returns Status da instância
   * @throws HttpException com status 404 se a instância não existir no Uazapi
   */
  async getInstanceStatus(token: string): Promise<InstanceStatusResponse> {
    try {
      const response = await this.axiosInstance.get<InstanceStatusResponse>(
        '/instance/status',
        {
          headers: {
            token,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      // Preservar status HTTP para que o caller possa distinguir entre "instância não existe" e outros erros
      if (error.response) {
        const status = error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const errorMessage = error.response.data?.message || error.message || 'Erro desconhecido';

        // Tratar erro 500 como possível token inválido (igual ao iAgenda)
        // Se a mensagem contém "Invalid token" ou similar, tratar como 401
        const isTokenError =
          status === 401 ||
          status === 500 && (
            errorMessage.toLowerCase().includes('invalid token') ||
            errorMessage.toLowerCase().includes('token') ||
            errorMessage.toLowerCase().includes('unauthorized')
          );

        // Log diferenciado para instância não encontrada vs outros erros
        if (status === 404 || isTokenError) {
          this.logger.warn(
            `Instância não encontrada ou token inválido ao verificar status (${status}): ${errorMessage}`,
          );
          // Se for erro de token (500 com mensagem de token ou 401), retornar como 401
          throw new HttpException(
            `Erro ao verificar status: ${errorMessage}`,
            isTokenError ? HttpStatus.UNAUTHORIZED : status,
          );
        } else {
          this.logger.error(
            `Erro ao verificar status (${status}): ${errorMessage}`,
            error.stack,
          );
        }

        throw new HttpException(
          `Erro ao verificar status: ${errorMessage}`,
          status,
        );
      }

      this.logger.error(`Erro ao verificar status: ${error.message}`, error.stack);
      throw new HttpException(
        `Erro ao verificar status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Deleta uma instância do Uazapi
   * Documentação: https://docs.uazapi.com/
   * Endpoint: DELETE /instance
   * Header: token (instance token)
   * @param token Token da instância
   * @throws HttpException com status 404/401 se a instância não existir
   */
  async deleteInstance(token: string): Promise<void> {
    try {
      this.logger.log('Deletando instância Uazapi');

      await this.axiosInstance.delete('/instance', {
        headers: {
          token,
        },
      });

      this.logger.log('Instância deletada com sucesso no Uazapi');
    } catch (error: any) {
      // Preservar status HTTP para que o caller possa distinguir entre "instância não existe" e outros erros
      if (error.response) {
        const status = error.response.status || HttpStatus.INTERNAL_SERVER_ERROR;
        const errorMessage = error.response.data?.message || error.message;

        // Log diferenciado para instância não encontrada vs outros erros
        if (status === 404 || status === 401) {
          this.logger.warn(
            `Instância não encontrada ou token inválido no Uazapi (${status}): ${errorMessage}`,
          );
        } else {
          this.logger.error(
            `Erro ao deletar instância no Uazapi (${status}): ${errorMessage}`,
            error.stack,
          );
        }

        throw new HttpException(
          `Erro ao deletar instância: ${errorMessage}`,
          status,
        );
      }

      this.logger.error(`Erro ao deletar instância: ${error.message}`, error.stack);
      throw new HttpException(
        `Erro ao deletar instância: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Configurar webhook para a instância
   * Documentação: https://docs.uazapi.com/endpoint/post/webhook
   * Endpoint: POST /webhook
   * Header: token (instance token)
   * @param token Token da instância
   * @param webhookUrl URL do webhook
   * @param options Opções do webhook (enabled, events, excludeMessages)
   */
  async setWebhook(
    token: string,
    webhookUrl: string,
    options?: {
      enabled?: boolean;
      events?: string[];
      excludeMessages?: string[];
    },
  ): Promise<void> {
    try {
      const payload = {
        enabled: options?.enabled ?? true,
        url: webhookUrl,
        events: options?.events ?? ['messages', 'connection'],
        excludeMessages: options?.excludeMessages ?? ['wasSentByApi', 'isGroupYes'],
      };

      this.logger.log(`Configurando webhook: ${webhookUrl}`, { payload });

      await this.axiosInstance.post(
        '/webhook',
        payload,
        {
          headers: {
            token,
          },
        },
      );

      this.logger.log(`Webhook configurado com sucesso: ${webhookUrl}`);
    } catch (error: any) {
      this.logger.error(`Erro ao configurar webhook: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao configurar webhook: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao configurar webhook: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Enviar mensagem de texto
   * Documentação: https://docs.uazapi.com/
   * Endpoint: POST /send/text
   * Header: token (instance token)
   * @param token Token da instância
   * @param phone Número de telefone (formato: 5511999999999)
   * @param message Texto da mensagem
   * @param buttons Botões opcionais
   */
  async sendMessage(
    token: string,
    phone: string,
    message: string,
    buttons?: Array<{ id: string; text: string }>,
  ): Promise<any> {
    try {
      const payload: any = {
        number: phone,
        text: message,
      };

      if (buttons && buttons.length > 0) {
        payload.buttons = buttons;
      }

      const response = await this.axiosInstance.post(
        '/send/text',
        payload,
        {
          headers: {
            token,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mensagem: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao enviar mensagem: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao enviar mensagem: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Enviar mídia (imagem, vídeo, documento)
   * Documentação: https://docs.uazapi.com/
   * Endpoint: POST /send/media
   * Header: token (instance token)
   * @param token Token da instância
   * @param phone Número de telefone (formato: 5511999999999)
   * @param url URL da mídia
   * @param mediaType Tipo de mídia (image, video, document)
   * @param caption Legenda opcional
   */
  async sendMedia(
    token: string,
    phone: string,
    url: string,
    mediaType: 'image' | 'video' | 'document' = 'image',
    caption?: string,
  ): Promise<any> {
    try {
      const payload: any = {
        number: phone,
        mediatype: mediaType,
        media: url,
      };

      if (caption) {
        payload.caption = caption;
      }

      const response = await this.axiosInstance.post(
        '/send/media',
        payload,
        {
          headers: {
            token,
          },
        },
      );

      return response.data;
    } catch (error: any) {
      this.logger.error(`Erro ao enviar mídia: ${error.message}`, error.stack);
      if (error.response) {
        throw new HttpException(
          `Erro ao enviar mídia: ${error.response.data?.message || error.message}`,
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      throw new HttpException(
        `Erro ao enviar mídia: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Gerar URL do webhook com instance_id
   */
  generateWebhookUrl(instanceId: string): string {
    return `${this.webhookBaseUrl}/webhook/uazapi?instance_id=${instanceId}`;
  }

  /**
   * Helper function para verificar se erro é 404/401 (instância não existe no Uazapi)
   */
  isInstanceNotFoundError(error: any): boolean {
    // Verificar se é HttpException e usar getStatus() - CORRETO para NestJS
    if (error instanceof HttpException) {
      const status = error.getStatus();
      return status === 404 || status === 401;
    }

    // Fallback para verificar propriedades (caso não seja HttpException)
    if (error.status === 404 || error.status === 401) {
      return true;
    }

    if (error.response?.status === 404 || error.response?.status === 401) {
      return true;
    }

    // Verificar mensagens de erro como último recurso
    const errorMessage = error.message || '';
    if (
      errorMessage.includes('404') ||
      errorMessage.includes('401') ||
      errorMessage.includes('Invalid token') ||
      errorMessage.includes('not found')
    ) {
      return true;
    }

    return false;
  }
}
