import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { UpdateAgentConfigDto } from './dto/update-agent-config.dto';
import { UpdateAgentFeaturesDto } from './dto/update-agent-features.dto';

@Controller('agent-config')
export class AgentConfigController {
  constructor(private readonly agentConfigService: AgentConfigService) {}

  @Get(':empresa_id')
  async getConfig(@Param('empresa_id') empresaId: string) {
    return this.agentConfigService.getConfig(empresaId);
  }

  @Patch(':empresa_id')
  async updateConfig(
    @Param('empresa_id') empresaId: string,
    @Body() dto: UpdateAgentConfigDto,
  ) {
    return this.agentConfigService.updateConfig(empresaId, dto);
  }

  @Get(':empresa_id/features')
  async getFeatures(@Param('empresa_id') empresaId: string) {
    return this.agentConfigService.getFeatures(empresaId);
  }

  @Patch(':empresa_id/features')
  async updateFeatures(
    @Param('empresa_id') empresaId: string,
    @Body() dto: UpdateAgentFeaturesDto,
  ) {
    return this.agentConfigService.updateFeatures(empresaId, dto);
  }
}

