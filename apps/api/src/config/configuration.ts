import { ConfigModule, ConfigService } from '@nestjs/config';
import type { ModuleMetadata } from '@nestjs/common';
import { validateEnv, type AppEnv } from './env.schema';

export const ConfigModuleSetup: ModuleMetadata['imports'] = [
  ConfigModule.forRoot({
    isGlobal: true,
    cache: true,
    expandVariables: true,
    validate: validateEnv,
  }),
];

export type AppConfigService = ConfigService<AppEnv, true>;
