import numbro from 'numbro';

/**
 * Compact figure for token amounts, same rules as the HOPR hub: about 3
 * significant digits rounded down with k/m/b suffixes, '~0' for dust.
 */
export function shrinkNumber(value?: string | number | null): string {
  if (value === undefined || value === null || value === '') return '-';
  let originalValue;
  if (typeof value === 'string') {
    originalValue = parseFloat(value);
    if (value.includes('.')) {
      const parts = value.split('.');
      value = parts[0] + '.' + parts[1].slice(0, 6);
    }
    value = parseFloat(value);
  } else {
    originalValue = value;
  }
  if (originalValue === 0) return '0';
  let shrank = numbro(value).format({
    roundingFunction: Math.floor,
    trimMantissa: true,
    optionalMantissa: true,
    thousandSeparated: true,
    totalLength: 3,
  });
  if (shrank === '0' && originalValue > 0) shrank = '~' + shrank;
  return shrank;
}

// 0x12345...abcde
export function shortenAddress(address: string): string {
  if (address.length < 13) return address;
  return `${address.slice(0, 7)}...${address.slice(-5)}`;
}
