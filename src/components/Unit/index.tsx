// number (a k/M/B/T magnitude stays with it), then a unit after a space or a '/':
// '1.5 GB', '44.0 kB/s', '12.0/s', '≈ 2.66 wxHOPR'; '394.75k' has no unit
const UNIT_REGEX = /^(.*?\d(?:[\d.,]*\d)?[kMBT]?)(?:\s+(\S.*)|(\/.*))$/;

/** Splits '1.5 GB' into ['1.5', 'GB']; text without a unit comes back whole with an empty unit. */
export const splitUnit = (text: string): [string, string] => {
  const match = text.match(UNIT_REGEX);
  return match ? [match[1], match[2] ?? match[3]] : [text, ''];
};

/** A figure with its unit name in the smaller unit style. */
export const WithUnit = ({ text }: { text: string }) => {
  const [value, unit] = splitUnit(text);
  return (
    <span>
      {value}
      {unit && <span className={`unit ${unit.startsWith('/') ? 'unit-tight' : ''}`}>{unit}</span>}
    </span>
  );
};
