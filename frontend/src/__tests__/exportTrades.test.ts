import {
  serializeTradesToCsv,
  serializeTradesToJson,
  sanitizeCsvField,
  generateExportFilename,
  type ExportableTrade,
} from '../lib/exportTrades';

const sampleTrades: ExportableTrade[] = [
  {
    id: '1',
    assetCode: 'XLM',
    assetName: 'Stellar',
    side: 'buy',
    amount: '100',
    price: '0.25',
    total: '25',
    status: 'completed',
    counterparty: 'alice',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    assetCode: 'USDC',
    assetName: 'USD Coin',
    side: 'sell',
    amount: '50',
    price: '1.00',
    total: '50',
    status: 'pending',
    counterparty: 'bob',
    createdAt: '2024-02-01T00:00:00.000Z',
  },
];

describe('sanitizeCsvField', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizeCsvField(null)).toBe('');
    expect(sanitizeCsvField(undefined)).toBe('');
  });

  it('leaves normal text unchanged', () => {
    expect(sanitizeCsvField('hello world')).toBe('hello world');
  });

  it('prefixes leading = with a single quote', () => {
    expect(sanitizeCsvField('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
  });

  it('prefixes leading + with a single quote', () => {
    expect(sanitizeCsvField('+1234')).toBe("'+1234");
  });

  it('prefixes leading - with a single quote', () => {
    expect(sanitizeCsvField('-1234')).toBe("'-1234");
  });

  it('prefixes leading @ with a single quote', () => {
    expect(sanitizeCsvField('@SUM')).toBe("'@SUM");
  });

  it('does not sanitize characters that are not leading', () => {
    expect(sanitizeCsvField('a=b+c-d@e')).toBe('a=b+c-d@e');
  });

  it('sanitizes leading whitespace-trimmed dangerous characters', () => {
    expect(sanitizeCsvField('  =cmd')).toBe("'  =cmd");
  });
});

describe('serializeTradesToCsv', () => {
  it('produces a header row followed by data rows', () => {
    const csv = serializeTradesToCsv(sampleTrades);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe(
      'id,assetCode,assetName,side,amount,price,total,status,counterparty,createdAt',
    );
    expect(lines).toHaveLength(3);
  });

  it('uses CRLF line endings per RFC-4180', () => {
    const csv = serializeTradesToCsv(sampleTrades);
    expect(csv).toContain('\r\n');
    expect(csv.split('\n').every((l) => l === '' || l.endsWith('\r'))).toBe(true);
  });

  it('quotes fields containing commas', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: 'Smith, John' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('"Smith, John"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: 'He said "hi"' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('"He said ""hi"""');
  });

  it('quotes fields containing newlines', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: 'line1\nline2' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('"line1\nline2"');
  });

  it('quotes fields containing carriage returns', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: 'line1\rline2' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('"line1\rline2"');
  });

  it('sanitizes formula injection in text fields', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: '=cmd|calc' },
      { ...sampleTrades[1], counterparty: '+1+1' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain("'=cmd|calc");
    expect(csv).toContain("'+1+1");
  });

  it('sanitizes and quotes when both are needed', () => {
    const trades: ExportableTrade[] = [
      { ...sampleTrades[0], counterparty: '=a,b' },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('"\'=a,b"');
  });

  it('handles an empty trade list by emitting only the header', () => {
    const csv = serializeTradesToCsv([]);
    expect(csv).toBe(
      'id,assetCode,assetName,side,amount,price,total,status,counterparty,createdAt',
    );
  });

  it('handles missing optional fields gracefully', () => {
    const trades: ExportableTrade[] = [
      {
        id: '3',
        assetCode: 'BTC',
        side: 'buy',
        amount: '1',
        price: '1',
        total: '1',
        status: 'completed',
        createdAt: '2024-03-01T00:00:00.000Z',
      },
    ];
    const csv = serializeTradesToCsv(trades);
    expect(csv).toContain('3,BTC,,buy,1,1,1,completed,,2024-03-01T00:00:00.000Z');
  });
});

describe('serializeTradesToJson', () => {
  it('produces valid JSON containing all trades', () => {
    const json = serializeTradesToJson(sampleTrades);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].id).toBe('1');
    expect(parsed[1].id).toBe('2');
  });

  it('preserves field values', () => {
    const json = serializeTradesToJson(sampleTrades);
    const parsed = JSON.parse(json);
    expect(parsed[0].assetCode).toBe('XLM');
    expect(parsed[1].counterparty).toBe('bob');
  });

  it('handles an empty trade list', () => {
    const json = serializeTradesToJson([]);
    expect(JSON.parse(json)).toEqual([]);
  });
});

describe('generateExportFilename', () => {
  it('generates a timestamped CSV filename', () => {
    const filename = generateExportFilename('csv', new Date('2024-05-06T07:08:09.000Z'));
    expect(filename).toMatch(/^trades-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.csv$/);
    expect(filename).toContain('2024-05-06');
  });

  it('generates a timestamped JSON filename', () => {
    const filename = generateExportFilename('json', new Date('2024-05-06T07:08:09.000Z'));
    expect(filename).toMatch(/^trades-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/);
  });

  it('produces different filenames for different timestamps', () => {
    const a = generateExportFilename('csv', new Date('2024-01-01T00:00:00.000Z'));
    const b = generateExportFilename('csv', new Date('2024-01-01T00:00:01.000Z'));
    expect(a).not.toBe(b);
  });

  it('does not contain characters invalid in filenames', () => {
    const filename = generateExportFilename('csv', new Date('2024-05-06T07:08:09.000Z'));
    expect(filename).not.toMatch(/[:/\\?*"<>|]/);
  });
});