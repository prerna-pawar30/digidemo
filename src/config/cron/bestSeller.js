import cron from "node-cron";
import  Order  from "../../models/ecommarace/order.model.js";
import Product from "../../models/manage/product.model.js";

export const bestSellerCronJob = () => {
  // Run every 1 hour
   cron.schedule("0 0 8 * * *", async () => {
     //cron.schedule("* * * * * *", async () => {
    try {
      console.log("Running Best Selling Cron Job");

       // Check if any orders exist
       const orderCount = await Order.countDocuments();

       if (orderCount === 0) {
         console.log("No orders found. Skipping Best Seller Cron Job.");
         return;
       }
      // 1️⃣ Aggregate top-selling products
      const bestSellers = await Order.aggregate([
        {
          $match: {
            paymentStatus: { $in: ["paid", "success"] },
            orderStatus: { $in: ["placed", "confirmed", "shipped", "delivered"] },
          },
        },
        { $unwind: "$items" },
        {
          $match: { "items.productId": { $exists: true, $ne: null } },
        },
        {
          $group: {
            _id: "$items.productId", // UUID productId
            totalSoldQuantity: { $sum: "$items.quantity" },
          },
        },
        { $sort: { totalSoldQuantity: -1 } },
        { $limit: 6 },
      ]);

      if (!bestSellers.length) {
        console.log("No best selling found");
        return;
      }

      const bestSellingProductIds = bestSellers.map((item) => item._id);

      console.log("🏆 Best selling productIds:", bestSellingProductIds);

      // 2️⃣ Remove "Best seller" label from products NOT in best sellers
      await Product.updateMany(
        {
          labels: { $in: ["best_selling"] }, // array check
          productId: { $nin: bestSellingProductIds },
        },
        { $pull: { labels: "best_selling" } }
      );

      // 3️⃣ Add "Best seller" label to top products
      const result = await Product.updateMany(
        {
          productId: { $in: bestSellingProductIds },
          status: "active",
        },
        { $addToSet: { labels: "best_selling" } } // ✅ add to array
      );

      console.log("Modified products:", result.modifiedCount);
    } catch (error) {
      console.error("Best Seller Cron Error:", error);
    }
  });
};
