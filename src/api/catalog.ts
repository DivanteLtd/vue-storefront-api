import jwt from 'jwt-simple'
import ProcessorFactory from '../processor/factory'
import { getClient as esClient, adjustQuery, adjustQueryParams, getTotals } from '../lib/elastic'
import cache from '../lib/cache-instance'
import { sha3_224 } from 'js-sha3'
import AttributeService from './attribute/service'
import bodybuilder from 'bodybuilder'
import loadCustomFilters from '../helpers/loadCustomFilters'
import { elasticsearch, SearchQuery } from 'storefront-query-builder'
import { apiError } from '../lib/util'

async function _cacheStorageHandler (config, result, hash, tags) {
  if (config.server.useOutputCache && cache) {
    return cache.set(
      'api:' + hash,
      result,
      tags
    ).catch((err) => {
      console.error(err)
    })
  }
}

function _outputFormatter (responseBody, format = 'standard') {
  if (format === 'compact') { // simple formatter
    delete responseBody.took
    delete responseBody.timed_out
    delete responseBody._shards
    if (responseBody.hits) {
      delete responseBody.hits.max_score
      responseBody.total = getTotals(responseBody)
      responseBody.hits = responseBody.hits.hits.map(hit => {
        return Object.assign(hit._source, { _score: hit._score })
      })
    }
  }
  return responseBody
}

export default ({config, db}) => async function (req, res, body) {
  let groupId = null

  // Request method handling: exit if not GET or POST
  // Other methods - like PUT, DELETE etc. should be available only for authorized users or not available at all)
  if (!(req.method === 'GET' || req.method === 'POST' || req.method === 'OPTIONS')) {
    const errMessage = 'ERROR: ' + req.method + ' request method is not supported.';
    console.error(errMessage);
    apiError(res, errMessage);
    return;
  }

  let responseFormat = 'standard'
  let requestBody = req.body
  if (req.method === 'GET') {
    if (req.query.request) { // this is in fact optional
      try {
        requestBody = JSON.parse(decodeURIComponent(req.query.request))
      } catch (err) {
        console.error(err);
        apiError(res, err);
        return;
      }
    }
  }

  if (req.query.request_format === 'search-query') { // search query and not Elastic DSL - we need to translate it
    const customFilters = await loadCustomFilters(config)
    requestBody = await elasticsearch.buildQueryBodyFromSearchQuery({ config, queryChain: bodybuilder(), searchQuery: new SearchQuery(requestBody), customFilters })
  }
  if (req.query.response_format) responseFormat = req.query.response_format

  const urlSegments = req.url.split('/')

  let indexName = ''
  let entityType = ''
  if (urlSegments.length < 2) {
    const errMessage = 'No index name given in the URL. Please do use following URL format: /api/catalog/<index_name>/<entity_type>_search';
    console.error(errMessage);
    apiError(res, errMessage);
    return;
  } else {
    indexName = urlSegments[1]

    if (urlSegments.length > 2) { entityType = urlSegments[2] }

    if (config.elasticsearch.indices.indexOf(indexName) < 0) {
      const errMessage = 'Invalid / inaccessible index name given in the URL. Please do use following URL format: /api/catalog/<index_name>/_search';
      console.error(errMessage);
      apiError(res, errMessage);
      return;
    }

    if (urlSegments[urlSegments.length - 1].indexOf('_search') !== 0) {
      const errMessage = 'Please do use following URL format: /api/catalog/<index_name>/_search';
      console.error(errMessage);
      apiError(res, errMessage);
      return;
    }
  }

  // Decode token and get group id
  const userToken = requestBody.groupToken
  if (userToken && userToken.length > 10) {
    /**
     * We need to use try catch so when we change the keys for encryption that not every request with a loggedin user
     * fails with a 500 at this point.
     **/
    try {
      const decodeToken = jwt.decode(userToken, config.authHashSecret ? config.authHashSecret : config.objHashSecret)
      groupId = decodeToken.group_id || groupId
    } catch (err) {}
  } else if (requestBody.groupId) {
    groupId = requestBody.groupId || groupId
  }

  delete requestBody.groupToken
  delete requestBody.groupId

  const s = Date.now()
  const reqHash = sha3_224(`${JSON.stringify(requestBody)}${req.url}`)
  const dynamicRequestHandler = () => {
    const reqQuery = Object.assign({}, req.query)
    const reqQueryParams = adjustQueryParams(reqQuery, entityType, config)

    const query = adjustQuery({
      index: indexName,
      method: req.method,
      body: requestBody
    }, entityType, config)

    esClient(config)
      .search(Object.assign(query, reqQueryParams))
      .then(async response => {
        let { body: _resBody } = response

        if (_resBody.error) {
          console.error('An error occured during catalog request:', _resBody.error)
          apiError(res, _resBody.error)
          return
        }

        try {
          if (_resBody && _resBody.hits && _resBody.hits.hits) { // we're signing up all objects returned to the client to be able to validate them when (for example order)
            const factory = new ProcessorFactory(config)
            const tagsArray = []
            if (config.server.useOutputCache && cache) {
              const tagPrefix = entityType[0].toUpperCase() // first letter of entity name: P, T, A ...
              tagsArray.push(entityType)
              _resBody.hits.hits.map(item => {
                if (item._source.id) { // has common identifier
                  tagsArray.push(`${tagPrefix}${item._source.id}`)
                }
              })
              const cacheTags = tagsArray.join(' ')
              res.setHeader('X-VS-Cache-Tags', cacheTags)
            }

            let resultProcessor = factory.getAdapter(entityType, indexName, req, res)

            if (!resultProcessor) { resultProcessor = factory.getAdapter('default', indexName, req, res) } // get the default processor

            const productGroupId = entityType === 'product' ? groupId : undefined
            const result = await resultProcessor.process(_resBody.hits.hits, productGroupId)
            _resBody.hits.hits = result
            if (entityType === 'product' && _resBody.aggregations && config.entities.attribute.loadByAttributeMetadata) {
              const attributeListParam = AttributeService.transformAggsToAttributeListParam(_resBody.aggregations)
              // find attribute list
              const attributeList = await AttributeService.list(attributeListParam, config, indexName)
              _resBody.attribute_metadata = attributeList.map(AttributeService.transformToMetadata)
            }

            _resBody = _outputFormatter(_resBody, responseFormat)

            if (config.get('varnish.enabled')) {
              // Add tags to cache, so we can display them in response headers then
              _cacheStorageHandler(config, {
                ..._resBody,
                tags: tagsArray
              }, reqHash, tagsArray)
            } else {
              _cacheStorageHandler(config, _resBody, reqHash, tagsArray)
            }
          }

          res.json(_resBody)
        } catch (err) {
          apiError(res, err)
        }
      })
      .catch(err => {
        apiError(res, err)
      })
  }

  if (config.server.useOutputCache && cache) {
    cache.get(
      'api:' + reqHash
    ).then(output => {
      if (output !== null) {
        res.setHeader('X-VS-Cache', 'Hit')
        if (config.get('varnish.enabled')) {
          const tagsHeader = output.tags.join(' ')
          res.setHeader('X-VS-Cache-Tag', tagsHeader)
          delete output.tags
        }
        res.json(output)
        console.log(`cache hit [${req.url}], cached request: ${Date.now() - s}ms`)
      } else {
        res.setHeader('X-VS-Cache', 'Miss')
        console.log(`cache miss [${req.url}], request: ${Date.now() - s}ms`)
        dynamicRequestHandler()
      }
    }).catch(err => console.error(err))
  } else {
    dynamicRequestHandler()
  }
}
