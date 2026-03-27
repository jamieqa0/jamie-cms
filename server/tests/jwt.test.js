const { signAccessToken, signRefreshToken, verifyAccessToken } = require('../src/utils/jwt');

test('access token 발급 및 검증', () => {
  const payload = { userId: 'test-id', role: 'user' };
  const token = signAccessToken(payload);
  const decoded = verifyAccessToken(token);
  expect(decoded.userId).toBe('test-id');
  expect(decoded.role).toBe('user');
});

test('만료된 토큰은 에러 발생', () => {
  expect(() => verifyAccessToken('invalid.token.here')).toThrow();
});
