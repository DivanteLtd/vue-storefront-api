import ImageCache from '../abstract'
import { createHash } from 'crypto'
import { Client } from 'minio'

export default class MinioS3ImageCache extends ImageCache {
  private static client: Client

  public constructor (config, req) {
    super(config, req)
    if (MinioS3ImageCache.client === undefined) {
      MinioS3ImageCache.client = new Client(this.moduleConfig.libraryOptions)
    }
  }

  public get moduleConfig (): any {
    return this.config.imageable.caching['minio-s3']
  }

  public async getImageFromCache () {
    return new Promise((resolve, reject) => {
      const chunks = []
      MinioS3ImageCache.client.getObject(this.moduleConfig.bucket, this.key, (err, stream) => {
        if (err) reject(err)
        stream.on('data', (chunk) => {
          chunks.push(chunk)
        })
        stream.on('end', () => {
          this.image = Buffer.concat(chunks)
          resolve()
        })
        stream.on('error', (err) => {
          reject(err)
        })
      })
    }).catch((e) => {
      console.log(e)
    })
  }

  public async save () {
    await MinioS3ImageCache.client.putObject(this.moduleConfig.bucket, this.key, this.image)
  }

  public async check () {
    try {
      await MinioS3ImageCache.client.statObject(this.moduleConfig.bucket, this.key)
      return true
    } catch (e) {
      return false
    }
  }

  public createKey (): string {
    return createHash('md5').update(this.req.url).digest('hex')
  }

  public isValidFor (type) {
    return type === 'minio-s3'
  }
}
