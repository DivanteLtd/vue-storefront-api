import * as util from '../../util'

const SECRET = '__SECRET__'

describe('encryptToken and decryptToken method', () => {
  describe('decrypt changes parameter', () => {
    it('Should return something else', () => {
      const testPassword = 'IAmaPassword123!'
      const result = util.encryptToken(testPassword, SECRET)

      expect(result).not.toEqual(testPassword);
    })
  })
  describe('decrypt reverses encrypt', () => {
    it('Should return the password', () => {
      const testPassword = 'IAmaPassword123!'
      const result = util.decryptToken(util.encryptToken(testPassword, SECRET), SECRET)

      expect(result).toEqual(testPassword);
    })
  })
})
