import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'sr:public';

/** Marks an endpoint as anonymous-accessible (skips JWT auth guard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
