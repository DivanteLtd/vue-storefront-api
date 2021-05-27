import { Request, Response } from 'express';
import { IConfig } from 'config';
const jwa = require('jwa');
const hmac = jwa('HS256');

class HmacProcessor {
  private _config: IConfig
  private _entityType: any
  private _indexName: any
  private _req: Request
  private _res: Response

  public constructor (config: IConfig, entityType: any, indexName: any, req: Request, res: Response) {
    this._config = config
    this._entityType = entityType
    this._indexName = indexName
    this._req = req
    this._res = res
  }

  public process (items) {
    const processorChain = []
    return new Promise((resolve, reject) => {
      const rs = items.map((item) => {
        if (this._req.query._source_exclude && (this._req.query._source_exclude as string[]).indexOf('sgn') < 0) {
          item._source.sgn = hmac.sign(item._source, this._config.get('objHashSecret')); // for products we sign off only price and id because only such data is getting back with orders
        }
        return item
      })

      // return first resultSet
      resolve(rs)
    })
  }
}

module.exports = HmacProcessor
