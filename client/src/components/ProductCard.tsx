
import { formatPrice, Product, useStore } from "@/lib/store";

export function ProductCard({ product }: { product: Product }) {
  const { storeSettings } = useStore();

  return (
    <article className="product-card">
      <div className="product-media">
        <img src={product.image} alt={product.name} />

        {product.tag && (
          <span className="product-tag">{product.tag}</span>
        )}
      </div>

      <div className="product-content">
        <h3>{product.name}</h3>

        <div className="product-bottom">
          <div>
            <strong>
              {formatPrice(product.price)}
              <small> {storeSettings.currency || "ج.م"}</small>
            </strong>

            {product.oldPrice && (
              <del>{formatPrice(product.oldPrice)}</del>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ProductRowCard({ product }: { product: Product }) {
  const { storeSettings } = useStore();

  return (
    <article className="product-row-card">
      <img src={product.image} alt={product.name} />

      <div className="product-row-main">
        <h3>{product.name}</h3>

        <div className="product-row-actions">
          <strong>
            {formatPrice(product.price)}
            <small> {storeSettings.currency || "ج.م"}</small>
          </strong>
        </div>
      </div>
    </article>
  );
}
