import config from 'config';
import crypto from 'crypto';
const algorithm = 'aes-256-ctr';
const IV_LENGTH = 16;
const IV = crypto.randomBytes(IV_LENGTH);

/**
 * Get current store code from parameter passed from the vue storefront frotnend app
 * @param {Express.Request} req
 */
export function getCurrentStoreCode (req) {
  if (req.headers['x-vs-store-code']) {
    return req.headers['x-vs-store-code']
  }
  if (req.query.storeCode) {
    return req.query.storeCode
  }
  return null
}

/**
 * Get the config.storeViews[storeCode]
 * @param {string} storeCode
 */
export function getCurrentStoreView (storeCode = null) {
  let storeView = { // current, default store
    tax: config.tax,
    i18n: config.i18n,
    elasticsearch: config.elasticsearch,
    storeCode: null,
    storeId: config.defaultStoreCode && config.defaultStoreCode !== '' ? config.storeViews[config.defaultStoreCode].storeId : 1
  }
  if (storeCode && config.storeViews[storeCode]) {
    storeView = config.storeViews[storeCode]
  }
  return storeView // main config is used as default storeview
}

/**  Creates a callback that proxies node callback style arguments to an Express Response object.
 *  @param {express.Response} res  Express HTTP Response
 *  @param {number} [status=200]  Status code to send on success
 *
 *  @example
 *    list(req, res) {
 *      collection.find({}, toRes(res));
 *    }
 */
export function toRes (res, status = 200) {
  return (err, thing) => {
    if (err) return res.status(500).send(err);

    if (thing && typeof thing.toObject === 'function') {
      thing = thing.toObject();
    }
    res.status(status).json(thing);
  };
}

export function sgnSrc (sgnObj, item) {
  if (config.tax.alwaysSyncPlatformPricesOver) {
    sgnObj.id = item.id
  } else {
    sgnObj.sku = item.sku
  }
  // console.log(sgnObj)
  return sgnObj
}

/**  Creates a api status call and sends it thru to Express Response object.
 *  @param {express.Response} res  Express HTTP Response
 *  @param {number} [code=200]    Status code to send on success
 *  @param {json} [result='OK']    Text message or result information object
 */
export function apiStatus (res, result = 'OK', code = 200, meta = null) {
  let apiResult = { code: code, result: result };
  if (meta !== null) {
    apiResult.meta = meta;
  }
  res.status(code).json(apiResult);
  return result;
}

/**
 *  Creates an error for API status of Express Response object.
 *
 *  @param {express.Response} res   Express HTTP Response
 *  @param {object|string} error    Error object or error message
 *  @return {json} [result='OK']    Text message or result information object
 */
export function apiError (res, error) {
  let errorCode = error.code || error.status;
  let errorMessage = error.errorMessage || error;
  if (error instanceof Error) {
    // Class 'Error' is not serializable with JSON.stringify, extract data explicitly.
    errorCode = error.code || errorCode;
    errorMessage = error.message;
  }
  return apiStatus(res, errorMessage, Number(errorCode) || 500);
}

/**
 * Create a cypher for the given secret with a max length of 32
 *
 * @param secret
 * @returns {string}
 */
function createCypher (secret) {
  return crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32);
}

export function encryptToken (textToken, secret) {
  const cipher = crypto.createCipheriv(algorithm, createCypher(secret), IV)
  let crypted = cipher.update(textToken, 'utf8', 'hex')
  crypted += cipher.final('hex');
  return crypted;
}

export function decryptToken (textToken, secret) {
  let iv = crypto.randomBytes(IV_LENGTH);
  const decipher = crypto.createDecipheriv(algorithm, createCypher(secret), IV)
  let dec = decipher.update(textToken, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}

export function getToken (req) {
  return config.users.tokenInHeader
    ? (req.headers.authorization || '').replace('Bearer ', '')
    : req.query.token
}
