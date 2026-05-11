import mongoose from "mongoose";
import bcrypt from "bcryptjs";
const { Schema } = mongoose;
import Review from "../manage/product.model.js";
import order from "./order.model.js";
import Cart from "./cart.model.js";

/* ---------------- ADDRESS SCHEMA ---------------- */
const addressSchema = new Schema({
  addressId: { type: String, required: true },
  label: { type: String, enum: ["Home", "Work", "Other"], default: "Home" },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  street: { type: String, required: true },
  area: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  country: { type: String, required: true },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

/* ---------------- ORDER REF ---------------- */

const orderRefSchema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    orderedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/* ---------------- USER SCHEMA ---------------- */

const userSchema = new Schema(
  {
    userId: { type: String, unique: true },

    firstName: { type: String, required: true, trim: true },

    lastName: { type: String, trim: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },

    phone: { type: String, trim: true },

    instituteName: { type: String },

    provider: {
      type: String,
      enum: ["manual", "google", "microsoft"],
      default: "manual",
    },

    providerId: { type: String },

    avatar: { type: String },

    passwordChangedAt: { type: Date },

    isActive: { type: Boolean, default: true },

    emailVerified: { type: Boolean, default: false },

    emailVerificationToken: {
      token: String,
      expiresAt: Date,
    },

    resetPasswordToken: { type: String, select: false },

    resetPasswordExpiresAt: { type: Date, select: false },

    address: [addressSchema],

    cart: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Cart",
    },

    couponUsed: [
      {
        code: { type: String },
        usedAt: { type: Date, default: Date.now },
        discountAmount: { type: Number, default: 0 },
      },
    ],

    orderHistory: [orderRefSchema],

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/* ---------------- PASSWORD COMPARE ---------------- */

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

/* ---------------- DELETE USER REVIEW REF ---------------- */

userSchema.pre("findOneAndDelete", async function () {
  const filter = this.getFilter();
  const user = await this.model.findOne(filter);

  if (user) {
    await Review.updateMany(
      { user: user._id },
      { $set: { user: null } }
    );
  }
});

/* ---------------- PRE SAVE MIDDLEWARE ---------------- */

userSchema.pre("save", async function () {
  
  /* Ensure only one default address */

  const defaultCount = this.address.filter((addr) => addr.isDefault).length;

  if (defaultCount > 1) {
    throw new Error("Only one address can be default");
  }

  /* Hash password */

  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/* ---------------- MODEL EXPORT ---------------- */

export default mongoose.model("User", userSchema);