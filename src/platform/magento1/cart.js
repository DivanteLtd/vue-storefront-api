import AbstractCartProxy from '../abstract/cart';
import { multiStoreConfig } from './util';

class CartProxy extends AbstractCartProxy {
  constructor (config, req) {
    const Magento1Client = require('magento1-vsbridge-client').Magento1Client;
    super(config, req)
    this.api = Magento1Client(multiStoreConfig(config.magento1.api, req));
  }
  create (customerToken) {
    return this.api.cart.create(customerToken);
  }
  update (customerToken, cartId, cartItem) {
    return this.api.cart.update(customerToken, cartId, cartItem);
  }
  delete (customerToken, cartId, cartItem) {
    return this.api.cart.delete(customerToken, cartId, cartItem);
  }
  pull (customerToken, cartId, params) {
    return this.api.cart.pull(customerToken, cartId, params);
  }
  totals (customerToken, cartId, params) {
    return this.api.cart.totals(customerToken, cartId, params);
  }
  getShippingMethods (customerToken, cartId, address) {
    return this.api.cart.shippingMethods(customerToken, cartId, address);
  }
  getPaymentMethods (customerToken, cartId) {
    return this.api.cart.paymentMethods(customerToken, cartId);
  }
  setShippingInformation (customerToken, cartId, address) {
    return this.api.cart.shippingInformation(customerToken, cartId, address);
  }
  collectTotals (customerToken, cartId, shippingMethod) {
    return this.api.cart.totals(customerToken, cartId, shippingMethod);
  }
  applyCoupon (customerToken, cartId, coupon) {
    return this.api.cart.applyCoupon(customerToken, cartId, coupon);
  }
  deleteCoupon (customerToken, cartId) {
    return this.api.cart.deleteCoupon(customerToken, cartId);
  }
  getCoupon (customerToken, cartId) {
    return this.api.cart.getCoupon(customerToken, cartId);
  }
}

module.exports = CartProxy;
