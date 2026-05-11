import cron from "node-cron";
import Coupon from "../../models/manage/coupon.model.js";

export const startCouponExpiryCron = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("Running Coupon Expiry Cron...");
      const now = new Date();

      const result = await Coupon.updateMany(
        {
          endDate: { $lt: now },
          isActive: true,
        },
        {
          $set: { isActive: false },
        }
      );
      console.log(
        `Expired coupons updated: ${result.modifiedCount}`
      );
    } catch (error) {
      console.error("Coupon Expiry Cron Error:", error.message);
    }
  });
};