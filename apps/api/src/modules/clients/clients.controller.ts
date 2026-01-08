import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ImportClientsDto } from './dto/import-clients.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('clients')
@UseGuards(AuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  async listClients(@CurrentUser() user: any) {
    const empresaId = user.empresa_id;
    return this.clientsService.listClients(empresaId);
  }

  @Get(':id')
  async getClient(@CurrentUser() user: any, @Param('id') clientId: string) {
    const empresaId = user.empresa_id;
    return this.clientsService.getClient(empresaId, clientId);
  }

  @Post()
  async createClient(@CurrentUser() user: any, @Body() createClientDto: CreateClientDto) {
    const empresaId = user.empresa_id;
    return this.clientsService.createClient(empresaId, createClientDto);
  }

  @Put(':id')
  async updateClient(
    @CurrentUser() user: any,
    @Param('id') clientId: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    const empresaId = user.empresa_id;
    return this.clientsService.updateClient(empresaId, clientId, updateClientDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteClient(@CurrentUser() user: any, @Param('id') clientId: string) {
    const empresaId = user.empresa_id;
    return this.clientsService.deleteClient(empresaId, clientId);
  }

  @Post('import')
  async importClients(@CurrentUser() user: any, @Body() importClientsDto: ImportClientsDto) {
    const empresaId = user.empresa_id;
    return this.clientsService.importClients(empresaId, importClientsDto);
  }
}

