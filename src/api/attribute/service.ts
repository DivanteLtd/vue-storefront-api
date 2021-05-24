
import TagCache from 'redis-tag-cache'
import get from 'lodash/get';
import cache from '../../lib/cache-instance'
import { adjustQuery, getClient as getElasticClient } from './../../lib/elastic'
import bodybuilder from 'bodybuilder'

export interface AttributeListParam {
  [key: string]: number[]
}

/**
 * Transforms ES aggregates into valid format for AttributeService - {[attribute_code]: [bucketId1, bucketId2]}
 * @param body - products response body
 * @param config - global config
 * @param indexName - current indexName
 */
function transformAggsToAttributeListParam (aggregations): AttributeListParam {
  const attributeListParam: AttributeListParam = Object.keys(aggregations)
    .filter(key => aggregations[key].buckets.length) // leave only buckets with values
    .reduce((acc, key) => {
      const attributeCode = key.replace(/^(agg_terms_|agg_range_)|(_options)$/g, '')
      const bucketsIds = aggregations[key].buckets.map(bucket => bucket.key)

      if (!acc[attributeCode]) {
        acc[attributeCode] = []
      }

      // there can be more then one attributes for example 'agg_terms_color' and 'agg_terms_color_options'
      // we need to get buckets from both
      acc[attributeCode] = [...new Set([...acc[attributeCode], ...bucketsIds])]

      return acc
    }, {})

  return attributeListParam
}

/**
 * Returns attributes from cache
 */
async function getAttributeFromCache (attributeCode: string, config) {
  if (config.server.useOutputCache && cache) {
    try {
      const res = await (cache as TagCache).get(
        'api:attribute-list' + attributeCode
      )
      return res
    } catch (err) {
      console.error(err)
      return null
    }
  }
}

/**
 * Save attributes in cache
 */
async function setAttributeInCache (attributeList, config) {
  if (config.server.useOutputCache && cache) {
    try {
      await Promise.all(
        attributeList.map(attribute => (cache as TagCache).set(
          'api:attribute-list' + attribute.attribute_code,
          attribute
        ))
      )
    } catch (err) {
      console.error(err)
    }
  }
}

/**
 * Returns attribute with only needed options
 * @param attribute - attribute object
 * @param optionsIds - list of only needed options ids
 */
function clearAttributeOptions (attribute, optionsIds: number[]) {
  const stringOptionsIds = optionsIds.map(String)
  return {
    ...attribute,
    options: (attribute.options || []).filter(option => stringOptionsIds.includes(String(option.value)))
  }
}

async function list (attributesParam: AttributeListParam, config, indexName: string): Promise<any[]> {
  // we start with all attributeCodes that are requested
  let attributeCodes = Object.keys(attributesParam)

  // here we check if some of attribute are in cache
  const rawCachedAttributeList = await Promise.all(
    attributeCodes.map(attributeCode => getAttributeFromCache(attributeCode, config))
  )

  const cachedAttributeList = rawCachedAttributeList
    .map((cachedAttribute, index) => {
      if (cachedAttribute) {
        const attributeOptionsIds = attributesParam[cachedAttribute.attribute_code]

        // side effect - we want to reduce starting 'attributeCodes' if some of them are in cache
        attributeCodes.splice(index, 1)

        // clear unused options
        return clearAttributeOptions(cachedAttribute, attributeOptionsIds)
      }
    })
    // remove empty results from cache.get
    // this needs to be after .map because we want to have same indexes as are in attributeCodes
    .filter(Boolean)

  // if all requested attributes are in cache then we can return here
  if (!attributeCodes.length) {
    return cachedAttributeList
  }

  // fetch attributes for rest attributeCodes
  try {
    const query = adjustQuery({
      index: indexName,
      body: bodybuilder().filter('terms', 'attribute_code', attributeCodes).build()
    }, 'attribute', config)
    const response = await getElasticClient(config).search(query)
    const fetchedAttributeList = get(response.body, 'hits.hits', []).map(hit => hit._source)

    // save atrributes in cache
    await setAttributeInCache(fetchedAttributeList, config)

    // cached and fetched attributes
    const allAttributes = [
      ...cachedAttributeList,
      ...fetchedAttributeList.map(fetchedAttribute => {
        const attributeOptionsIds = attributesParam[fetchedAttribute.attribute_code]

        // clear unused options
        return clearAttributeOptions(fetchedAttribute, attributeOptionsIds)
      })
    ]

    return allAttributes
  } catch (err) {
    console.error(err)
    return []
  }
}

/**
 * Returns only needed data for filters in vsf
 */
function transformToMetadata ({
  is_visible_on_front,
  is_visible,
  default_frontend_label,
  attribute_id,
  entity_type_id,
  id,
  is_user_defined,
  is_comparable,
  attribute_code,
  slug,
  options = []
}) {
  return {
    is_visible_on_front,
    is_visible,
    default_frontend_label,
    attribute_id,
    entity_type_id,
    id,
    is_user_defined,
    is_comparable,
    attribute_code,
    slug,
    options
  }
}

export default {
  list,
  transformToMetadata,
  transformAggsToAttributeListParam
}
