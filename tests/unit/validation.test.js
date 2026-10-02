const { isValidTitle } = require('../../src/validation');

describe('isValidTitle (unit)', () => {
  it('accepts a normal title', () => {
    expect(isValidTitle('Write report')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidTitle('')).toBe(false);
  });

  it('rejects a title with only spaces', () => {
    expect(isValidTitle('   ')).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isValidTitle(42)).toBe(false);
    expect(isValidTitle(undefined)).toBe(false);
  });
});
