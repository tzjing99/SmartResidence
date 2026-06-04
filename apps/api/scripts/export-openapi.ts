/**
 * Bootstraps the Nest app in offline mode and emits the OpenAPI spec to
 * `openapi.json` (and `openapi.yaml` if `js-yaml` is available). Run via:
 *
 *   pnpm --filter @smartresidence/api openapi:export
 *
 * The CI pipeline runs this on every API change and the generated client
 * (`packages/api-client`) is rebuilt from the result.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });

  const config = new DocumentBuilder()
    .setTitle('SmartResidence API')
    .setDescription('REST API for the SmartResidence condo management platform.')
    .setVersion(process.env.npm_package_version ?? '0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access')
    .addCookieAuth('sr.session')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outDir = join(process.cwd(), '..', '..', 'packages', 'api-client', 'openapi');
  await writeFile(join(outDir, 'openapi.json'), JSON.stringify(document, null, 2));
  console.log('Wrote', join(outDir, 'openapi.json'));

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
