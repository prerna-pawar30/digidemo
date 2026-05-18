import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/* CHECK CONNECTION */
redis
  .set("test", "Redis Connected")
  .then(() => {
    console.log("✅ Upstash Redis Connected Successfully");
  })
  .catch((error) => {
    console.log("❌ Redis Connection Error");
    console.error(error);
  });