export function calculateProductTax (product, taxClasses, taxCountry = 'PL', taxRegion = '') {
    let rateFound = false
    let taxClass = taxClasses.find((el) => el.product_tax_class_ids.indexOf(parseInt(product.tax_class_id) >= 0))
    if (taxClass) {
      for (let rate of taxClass.rates) { // TODO: add check for zip code ranges (!)
        if (rate.tax_country_id === taxCountry && (rate.region_name === taxRegion || rate.tax_region_id === 0 || !rate.region_name)) {
          product.priceInclTax = (product.price + product.price * (parseFloat(rate.rate) / 100))
          product.priceTax = (product.price * (parseFloat(rate.rate) / 100))
          product.price = parseFloat(product.price)
          product.special_price = parseFloat(product.special_price)

          product.specialPriceInclTax = (parseFloat(product.special_price) + parseFloat(product.special_price) * (parseFloat(rate.rate) / 100))
          product.specialPriceTax = (parseFloat(product.special_price) * (parseFloat(rate.rate) / 100))
  
          if (product.special_price) {
            product.originalPrice = product.price
            product.originalPriceInclTax = product.priceInclTax
            product.originalPriceTax = product.priceTax
  
            product.price = parseFloat(product.special_price)
            product.priceInclTax = product.specialPriceInclTax
            product.priceTax = product.specialPriceTax
          }
          if (product.configurable_children) {
            for (let configurableChild of product.configurable_children) {
              for (let opt of configurableChild.custom_attributes) {
                configurableChild[opt.attribute_code] = opt.value
              }
              configurableChild.price = parseFloat(configurableChild.price)              
              configurableChild.priceInclTax = (configurableChild.price + configurableChild.price * (parseFloat(rate.rate) / 100))
              configurableChild.priceTax = (configurableChild.price * (parseFloat(rate.rate) / 100))
  
              configurableChild.specialPriceInclTax = (parseFloat(configurableChild.special_price) + parseFloat(configurableChild.special_price) * (parseFloat(rate.rate) / 100))
              configurableChild.specialPriceTax = (parseFloat(configurableChild.special_price) * (parseFloat(rate.rate) / 100))
  
              if (configurableChild.special_price) {
                configurableChild.originalPrice = parseFloat(configurableChild.price)
                configurableChild.originalPriceInclTax = configurableChild.priceInclTax
                configurableChild.originalPriceTax = configurableChild.priceTax
  
                configurableChild.price = parseFloat(configurableChild.special_price)
                configurableChild.priceInclTax = configurableChild.specialPriceInclTax
                configurableChild.priceTax = configurableChild.specialPriceTax
              } else {
                configurableChild.special_price = 0
              }
  
              if (configurableChild.priceInclTax < product.priceInclTax || product.price === 0) { // always show the lowest price
                product.priceInclTax = parseFloat(configurableChild.priceInclTax)
                product.priceTax = parseFloat(configurableChild.priceTax)
                product.price = parseFloat(configurableChild.price)
                product.special_price = parseFloat(configurableChild.special_price)
                product.specialPriceInclTax = configurableChild.specialPriceInclTax
                product.specialPriceTax = configurableChild.specialPriceTax
                product.originalPrice = configurableChild.originalPrice
                product.originalPriceInclTax = configurableChild.originalPriceInclTax
                product.originalPriceTax = configurableChild.originalPriceTax
              }
            }
          }
          rateFound = true
          console.debug('Tax rate ' + rate.code + ' = ' + rate.rate + '% found for ' + taxCountry + ' / ' + taxRegion)
          break
        }
      }
    }
    if (!rateFound) {
      console.log('No such tax class id: ' + product.tax_class_id + ' or rate not found for ' + taxCountry + ' / ' + taxRegion)
      product.priceInclTax = product.price
      product.priceTax = 0
      product.specialPriceInclTax = 0
      product.specialPriceTax = 0
      if (product.configurable_children) {
        for (let configurableChildren of product.configurable_children) {
          configurableChildren.priceInclTax = configurableChildren.price
          configurableChildren.priceTax = 0
          configurableChildren.specialPriceInclTax = 0
          configurableChildren.specialPriceTax = 0
        }
      }
    }
  }
  /**
   * Calculate taxes for specific product collection
   */
  export function calculateTaxes (products, store) {
    return new Promise((resolve, reject) => {
      store.dispatch('tax/list', { query: '' }, { root: true }).then((tcs) => { // TODO: move it to the server side for one requests OR cache in indexedDb
        for (let product of products) {
          product = calculateProductTax(product, tcs)
        }
        resolve(products)
      })
    })
  }