import { describe, expect, it } from 'vitest';
import { buildPermitPdf } from './permit-pdf';

describe('buildPermitPdf', () => {
  it('emits a valid PDF buffer with access code content', () => {
    // Minimal 3x3 dark/light pattern — enough to exercise qrMatrix drawing.
    const modules = [
      [true, false, true],
      [false, true, false],
      [true, false, true],
    ];
    const buffer = buildPermitPdf({
      organizationName: 'Sunrise Residences',
      permitTitle: 'Renovation permit',
      reference: 'ABCD1234',
      unitLabel: 'A-12-03',
      residentName: 'Ali Bin Abu',
      contractorCompany: 'ABC Builders',
      workScope: 'Kitchen remodel',
      validFrom: '1 Aug 2026',
      validUntil: '20 Aug 2026',
      accessCode: 'H7K2M9',
      qrModules: modules,
      approvedByName: 'Manager',
      approvedAt: '9 Jul 2026, 10:00 am',
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(buffer.length).toBeGreaterThan(800);
    // Access code should appear in the PDF content stream (WinAnsi / latin1).
    expect(buffer.toString('latin1')).toContain('H7K2M9');
  });
});
