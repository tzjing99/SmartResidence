import type { ModuleMetadata } from '@nestjs/common';
import { ConfigModule, type ConfigService } from '@nestjs/config';
import { type AppEnv, validateEnv } from './env.schema';

export const ConfigModuleSetup: ModuleMetadata['imports'] = [
  ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    expandVariables: true,
    validate: validateEnv,
  }),
];

export type AppConfigService = ConfigService<AppEnv, true>;
