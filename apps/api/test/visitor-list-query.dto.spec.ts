import { ValidationPipe } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ListVisitorsQueryDto } from '../src/visitor/dto/visitor.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  transformOptions: { enableImplicitConversion: true },
});

describe('ListVisitorsQueryDto', () => {
  it('accepts upcoming view with pagination', async () => {
    const result = await pipe.transform(
      { view: 'upcoming', limit: '25', offset: '0' },
      { type: 'query', metatype: ListVisitorsQueryDto },
    );
    expect(result).toMatchObject({ view: 'upcoming', limit: 25, offset: 0 });
  });

  it('accepts history view', async () => {
    const result = await pipe.transform(
      { view: 'history' },
      { type: 'query', metatype: ListVisitorsQueryDto },
    );
    expect(result.view).toBe('history');
  });

  it('accepts live view for on-site visitors', async () => {
    const result = await pipe.transform(
      { view: 'live' },
      { type: 'query', metatype: ListVisitorsQueryDto },
    );
    expect(result.view).toBe('live');
  });

  it('rejects unknown query params', async () => {
    await expect(
      pipe.transform(
        { view: 'upcoming', foo: 'bar' },
        { type: 'query', metatype: ListVisitorsQueryDto },
      ),
    ).rejects.toThrow('Bad Request Exception');
  });
});
