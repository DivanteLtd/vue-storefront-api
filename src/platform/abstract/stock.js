class AbstractStockProxy {
  constructor (config, req) {
    this._config = config
    this._request = req
  }

  /**
   *
   * EXAMPLE INPUT:
   * ?sku=<product sku>
   *
   * EXAMPLE OUTPUT:
   *
   * {
   *    "item_id": 14,
   *    "product_id": 14,
   *    "stock_id": 1,
   *    "qty": 100,
   *    "is_in_stock": true,
   *    "is_qty_decimal": false,
   *    "show_default_notification_message": false,
   *    "use_config_min_qty": true,
   *    "min_qty": 0,
   *    "use_config_min_sale_qty": 1,
   *    "min_sale_qty": 1,
   *    "use_config_max_sale_qty": true,
   *    "max_sale_qty": 10000,
   *    "use_config_backorders": true,
   *    "backorders": 0,
   *    "use_config_notify_stock_qty": true,
   *    "notify_stock_qty": 1,
   *    "use_config_qty_increments": true,
   *    "qty_increments": 0,
   *    "use_config_enable_qty_inc": true,
   *    "enable_qty_increments": false,
   *    "use_config_manage_stock": true,
   *    "manage_stock": true,
   *    "low_stock_date": null,
   *    "is_decimal_divided": false,
   *    "stock_status_changed_auto": 0
   * }
   *
   */
  check (sku) {
    throw new Error('StockProxy::check must be implemented for specific platform')
  }
}

export default AbstractStockProxy
