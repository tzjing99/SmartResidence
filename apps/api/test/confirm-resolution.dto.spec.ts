import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ConfirmResolutionDto } from '../src/threads/dto/thread.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

describe('ConfirmResolutionDto', () => {
  it('accepts confirmed=true without extra fields', async () => {
    const result = await pipe.transform(
      { confirmed: true },
      { type: 'body', metatype: ConfirmResolutionDto },
    );
    expect(result).toMatchObject({ confirmed: true });
  });

  it('accepts reject fields when confirmed=false', async () => {
    const result = await pipe.transform(
      {
        confirmed: false,
        rejectReason: 'Still leaking',
        rejectExpectation: 'Send a plumber',
      },
      { type: 'body', metatype: ConfirmResolutionDto },
    );
    expect(result).toMatchObject({
      confirmed: false,
      rejectReason: 'Still leaking',
      rejectExpectation: 'Send a plumber',
    });
  });

  it('rejects thread id in body (client must use path param)', async () => {
    await expect(
      pipe.transform(
        { id: 'thread-1', confirmed: true },
        { type: 'body', metatype: ConfirmResolutionDto },
      ),
    ).rejects.toThrow('Bad Request Exception');
  });
});
