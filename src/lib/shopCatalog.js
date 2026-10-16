export function catalogStockItems(products) {
  return products.flatMap(product => product.has_variants
    ? (product.product_variants || []).filter(variant => variant.active).map(variant => ({
      ...product, id: variant.id, product_id: product.id, variant_id: variant.id,
      size_label: variant.size, product_name: product.name, name: `${product.name} · ${variant.size}`,
      sku: variant.sku || product.sku, quantity_on_hand: variant.quantity_on_hand,
    }))
    : [product])
}
