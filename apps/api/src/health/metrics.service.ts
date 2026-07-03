import { Injectable } from '@nestjs/common';

@Injectable()
export class MetricsService {
  private requestsTotal = 0;

  incrementRequests(): void {
    this.requestsTotal += 1;
  }

  getRequestsTotal(): number {
    return this.requestsTotal;
  }
}

export function formatPrometheusMetrics(input: {
  uptimeSeconds: number;
  heapUsedBytes: number;
  heapTotalBytes: number;
  requestsTotal: number;
  postgresUp: boolean;
  redisUp: boolean;
}): string {
  const lines: string[] = [];

  const append = (
    name: string,
    type: 'counter' | 'gauge',
    help: string,
    value: number,
    labels?: Record<string, string>,
  ) => {
    lines.push(`# HELP ${name} ${help}`);
    lines.push(`# TYPE ${name} ${type}`);
    const labelStr =
      labels && Object.keys(labels).length > 0
        ? `{${Object.entries(labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(',')}}`
        : '';
    lines.push(`${name}${labelStr} ${value}`);
    lines.push('');
  };

  append('process_uptime_seconds', 'gauge', 'Process uptime in seconds', input.uptimeSeconds);
  append('nodejs_heap_used_bytes', 'gauge', 'Node.js heap used in bytes', input.heapUsedBytes);
  append('nodejs_heap_total_bytes', 'gauge', 'Node.js heap total in bytes', input.heapTotalBytes);
  append('http_requests_total', 'counter', 'Total HTTP requests received', input.requestsTotal);
  append(
    'dependency_up',
    'gauge',
    'Whether a dependency is reachable (1=up, 0=down)',
    input.postgresUp ? 1 : 0,
    {
      dependency: 'postgres',
    },
  );
  append(
    'dependency_up',
    'gauge',
    'Whether a dependency is reachable (1=up, 0=down)',
    input.redisUp ? 1 : 0,
    {
      dependency: 'redis',
    },
  );

  return `${lines.join('\n')}\n`;
}

export function isLocalhostAddress(address: string | undefined): boolean {
  if (!address) return false;
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
