import mongoose from "mongoose";
const { Schema } = mongoose;

const cartItemSchema = new Schema({
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", 
    required: true },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    sku: String,
    productName: String,
    variantName: String,
    brandName: String,
    categoryName:String,
    price: { type: Number, required: true },
    quantity: { type: Number, min: 1, default: 1 },
    attributes: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    image: String,
  },
  { timestamps: true }
);

const cartSchema = new Schema({
    cartId: { type: String, unique: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);
export default mongoose.model("Cart", cartSchema);