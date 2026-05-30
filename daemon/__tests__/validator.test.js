const validator = require('../utils/validator');

describe('validator utilities', () => {
  test('valid URL passes and invalid protocols fail', () => {
    expect(validator.isValidUrl('https://example.com')).toBe(true);
    expect(validator.isValidUrl('http://localhost')).toBe(true);
    expect(validator.isValidUrl('ftp://example.com')).toBe(false);
    expect(validator.isValidUrl('javascript:alert(1)')).toBe(false);
  });

  test('domain validation rejects unsafe values', () => {
    expect(validator.isValidDomain('example.com')).toBe(true);
    expect(validator.isValidDomain('bad domain.com')).toBe(false);
    expect(validator.isValidDomain('../evil')).toBe(false);
    expect(validator.isValidDomain('')).toBe(false);
  });

  test('selector validation rejects dangerous patterns', () => {
    expect(validator.isValidSelector('button.submit')).toBe(true);
    expect(validator.isValidSelector('javascript:alert(1)')).toBe(false);
    expect(validator.isValidSelector('document.querySelector("#x")')).toBe(false);
    expect(validator.isValidSelector('img[src^="data:"]')).toBe(false);
  });

  test('code validation rejects high-risk JavaScript patterns', () => {
    expect(validator.isValidCode('console.log("hello")')).toBe(true);
    expect(validator.isValidCode('document.cookie')).toBe(false);
    expect(validator.isValidCode('new Function("return 1")')).toBe(false);
    expect(validator.isValidCode('window.location = "https://example.com"')).toBe(false);
  });
});
