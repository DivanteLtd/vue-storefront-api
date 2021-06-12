REST API backend for vue-storefront
===================================

This is a backend service for [vue-storefront](https://github.com/DivanteLtd/vue-storefront). Provides data access to product catalog (via ElasticSearch) and allows users to place orders into order queue (by default it's Redis queue supported via kqueue library).

## Vue Storefront

Vue Storefront is a standalone [PWA](https://developers.google.com/web/progressive-web-apps/) (Progressive Web Application ) storefront for your eCommerce, possible to connect with any eCommerce backend (eg. Magento, Prestashop or Shopware) through the API.

Vue Storefront is and always will be in the open source. Anyone can use and support the project, we want it to be a tool for the improvement of the shopping experience. The project is still in the prove of concept phase. We are looking for Contributors and Designer willing to help us the the solution development.

Vue Storefront was build as a all-in-one front-end for eCommerce. For providing the best performance we decided to use Vue.js as a front-end library, Node.js + Express (and maybe GraphQL support) as a server-API, Elastic Search as a database of products and full PWA/off-line support.
Here you can read more about the proof of concept for [Vue Storefront connected with Magento2](https://www.linkedin.com/pulse/magento2-nosql-database-pwa-support-piotr-karwatka).

Besides a big improvement for the shopping experience, we also want to create a great code base for every developer who needs to work on a front-end application for the eCommerce.

## Requirements

- Docker and Docker Compose

Already included in `vue-storefront-api` Docker image (required locally, if you do not use containerization):
- Node.js 10.x or higher
- Yarn

## Installation

**Start a containerized environment**

The **legacy** (A) mode - starting just the Elastic and Redis containers:
`docker-compose up -d`

The **standard** (B) mode - starting Elastic, Redis + Vue Storefront API containers:
`docker-compose -f docker-compose.yml -f docker-compose.nodejs.yml up -d`

As a result, all necessary services will be launched:
- Vue Storefront API runtime environment (Node.js with dependencies from `package.json`)
- [ElasticSearch](https://www.elastic.co/products/elasticsearch)
- [Redis](https://redis.io/)
- Kibana (optional)

**Import product catalog**

Product catalog is imported using [elasticdump](https://www.npmjs.com/package/elasticdump), which is installed automatically via project dependency. The default ElasticSearch index name is: `vue_storefront_catalog`

- (A) `yarn restore`
- (B) `docker exec -it vue-storefront-api_app_1 yarn restore`

Then, to update the structures in the database to the latest version (data migrations), do the following:

- (A) `yarn migrate`
- (B) `docker exec -it vue-storefront-api_app_1 yarn migrate`

By default, the application server is started in development mode. It means that code auto reload is enabled along with ESLint, babel support.

It restores JSON documents stored in `./var/catalog.json`. The opposite command - used to generate `catalog.json` file from running ElasticSearch cluster:

- (A) `yarn dump`
- (B) `docker exec -it vue-storefront-api_app_1 yarn dump`

**Access ElasticSearch data with Kibana**

A [Kibana](https://www.elastic.co/products/kibana) service is available to explore, search and visualize indexed data at the following url:

`http://localhost:5601/`

At first access it will ask to specify an index pattern, insert `vue_storefront*`

**Note:** Kibana is not provided with the Elastic 7 docker file. Please install it on your own when needed or check the [`es-head`](https://chrome.google.com/webstore/detail/elasticsearch-head/ffmkiejjmecolpfloofpjologoblkegm) Chrome plugin.

## Elastic 7 support

By default, Vue Storefront API docker files and config are based on Elastic 5.6. We plan to change the default Elastic version to 7 with the 1.11 stable release. As for now, the [Elastic 7 support](https://github.com/DivanteLtd/vue-storefront-api/pull/342) is marked as **experimental**. 

**How to use it?**

In order to use the new Elastic 7 please make sure your `vue-storefront-api` has been checked out from the [PR#342](https://github.com/DivanteLtd/vue-storefront-api/pull/342) branch.
To start the Elastic 7 docker service please use the `docker-compose.elastic7.yml` file provided:

```bash
docker-compose -f docker-compose.elastic7.yml up
```

Then, please do change the `config/local.json` to start using the new Elastic API. Key properties in the `elasticsearch` section are: `indexTypes` and `apiVersion` (to be set to 7.1). If you're using the multistore configuration please make sure you adjusted the `storeViews.*.elasticsearch` section as well - per each separate store.

```json
  "elasticsearch": {
    "host": "localhost",
    "index": "vue_storefront_catalog",
    "port": 9200,
    "protocol": "http",
    "min_score": 0.01,
    "indices": [
      "vue_storefront_catalog",
      "vue_storefront_catalog_de",
      "vue_storefront_catalog_it"
    ],
    "indexTypes": [
      "product",
      "category",
      "cms_block",
      "cms_page",
      "attribute",
      "taxrule",
      "review"
    ],
    "apiVersion": "7.1"
  }
```

Starting from [Elasitc 6 and 7](https://www.elastic.co/guide/en/elasticsearch/reference/current/breaking-changes-7.0.html) we can have **just single** document type per single index. Vue Storefront used to have `product`, `category` ... types defined in the `vue_storefront_catalog`.

From now on, we're using the separate indexes per each entity type. The convention is: `${indexName}_${entityType}`. If your' **logical index name** is `vue_storefront_catalog` then it will be mapped to the **physical indexes** of: `vue_storefront_catalog_product`, `vue_storefront_catalog_category` ...

[Tools](https://docs.vuestorefront.io/guide/data/database-tool.html) are adjusted to ES7. You can use `yarn db new`, `yarn restore`, `yarn mage2vs import`. Just make sure that you have set up `config.elasticsearch.apiVersion` to `7.1`.

## API access
Catalog API calls are compliant with ElasticSearch (it works like a filtering proxy to ES). More on ES queries: [ElasticSearch queries tutorial](http://okfnlabs.org/blog/2013/07/01/elasticsearch-query-tutorial.html)

Elastic search endpoint: `http://localhost:8080/api/catalog/search/<INDEX_NAME>/`. You can run the following command to check if everything is up and runing (it assumes `vue_storefront_catalog` as default index name):

`curl -i http://elastic:changeme@localhost:8080/api/catalog/vue_storefront_catalog/_search`

## Data formats
This backend is using ElasticSearch data formats popularized by [ElasticSuite for Magento2 by Smile.fr](https://github.com/Smile-SA/elasticsuite).

* [Product model](./src/models/catalog-product.md)
* [Category model](./src/models/catalog-category.md)

## Data migrations
Please use data migration mechanism provided to manipulate Redis, ElasticSearch or kue. Details: https://github.com/DivanteLtd/vue-storefront-api/tree/master/doc 

## Adding custom modules with own dependencies (Yarn only)
When adding custom [Extensions to the API](https://github.com/DivanteLtd/vue-storefront/blob/master/doc/Extending%20vue-storefront-api.md) you might want to define some dependencies inside them. Thanks to [Yarn workspaces](https://yarnpkg.com/lang/en/docs/workspaces/) dependencies defined inside your custom module will be installed when you execute `yarn` at project root level, so it's way easier and faster than installing all modules dependencies separately.

To do this, define the `package.json` with your dependencies in your custom module:
- `src/api/extensions/{your-custom-extension}/package.json` 
- `src/platforms/{your-custom-platform}/package.json`

Executing `docker exec -it vue-storefrontapiapp_1 yarn install` will also download your custom modules dependencies.

NOTE: `npm` users will still have to install the dependencies individually in their modules.

## Reviews
To use review feature you need to install custom module for Magento 2: [Divante ReviewApi](https://github.com/DivanteLtd/magento2-review-api)
By default new reviews will be added with status "Pending". 
```json
  "review": {
    "defaultReviewStatus": 2 
  },
```

## Output Cache
Vue Storefront API supports output cache for catalog operations. Cache is tagged and can by dynamically invalidated. Please find the details how to configure it [in our docs](https://docs.vuestorefront.io/guide/basics/ssr-cache.html).

You can manually clear the Redis cache for specific tags by running the following command:

```bash
npm run cache clear
npm run cache clear -- --tag=product,category
npm run cache clear -- --tag=P198
npm run cache clear -- --tag=*
```

## Running initial Magento2 import

Magento2 data import is now integrated into `vue-storefront-api` for simplicity. It's still managed by the [mage2vuestorefront](https://github.com/DivanteLtd/mage2vuestorefront) - added as a dependency to `vue-storefront-api`.

After setting the `config.magento2.api` section using Yours Magento2 oauth credentials:

```json
  "magento2": {
    "imgUrl": "http://localhost:8080/media/catalog/product",
    "assetPath": "/../var/magento2-sample-data/pub/media",
    "api": {
      "url": "http://demo-magento2.vuestorefront.io/rest",
      "consumerKey": "byv3730rhoulpopcq64don8ukb8lf2gq",
      "consumerSecret": "u9q4fcobv7vfx9td80oupa6uhexc27rb",
      "accessToken": "040xx3qy7s0j28o3q0exrfop579cy20m",
      "accessTokenSecret": "7qunl3p505rubmr7u1ijt7odyialnih9"
    }
  },
```

You can run the following command to execute the full import:

```bash
 yarn mage2vs import
 ```

 ... or in multistore setup You can run the same command with specified `store-code` parameter

```bash
 yarn mage2vs import --store-code=de
 ```

 Import of CMS blocks and pages is also performed by the full import. If the CMS API extension ((SnowdogApps/magento2-cms-api)[https://github.com/SnowdogApps/magento2-cms-api]) was not installed in magento 2, it's recommended to skip the CMS import commands.

```bash
 yarn mage2vs import --skip-blocks --skip-pages
 ```
 
## Executing delta indexer

You can use the following command to run a delta indexer for a specific storeview:

```
yarn mage2vs productsdelta --store-code=de
```

## Self signed certificates

Often in non production environment other services are using self signed certificates for secure connection.
You can easily setup the application to trust them by putting them in config/certs directory.  

License
-------

[MIT](./LICENSE)
