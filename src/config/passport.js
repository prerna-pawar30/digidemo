import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import User from "../models/ecommarace/user.model.js";
import { v6 as uuidv6 } from "uuid";
import { sendNotification } from "../services/notification.service.js";

/* ================= COMMON OAUTH HANDLER ================= */
export async function handleOAuth(profile, provider, done) {
  try {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(null, false, { message: `No email from ${provider}` });
    }

    const firstName = profile.name?.givenName || "Unknown";
    const lastName = profile.name?.familyName || "";
    const avatar = profile.photos?.[0]?.value;

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        userId: uuidv6(),
        firstName,
        lastName,
        email,
        avatar,
        provider,
        providerId: profile.id,
        emailVerified: true,
        password: `${provider.toUpperCase()}_AUTH_USER`,
      });

      /* ---------- SEND NOTIFICATION ---------- */
      try {
        await sendNotification({
          permission: "customer.listing.read",
          title: "New User Registered",
          message: `${firstName} ${lastName} registered using ${provider}`,
          type: "USER_REGISTERED",
          entityId: user._id,
          entityModel: "User",
          metadata: {
            userId: user.userId,
            fullName: `${firstName} ${lastName}`,
            email: user.email,
            provider,
          },
        });
      } catch (notifyErr) {
        console.error("Notification failed:", notifyErr.message);
      }

    } else {
      if (user.provider !== provider) {
        user.provider = provider;
        user.providerId = profile.id;
      }
      user.emailVerified = true;
      if (!user.avatar && avatar) {
        user.avatar = avatar;
      }
      await user.save();
    }

    return done(null, user);
  } catch (err) {
    console.error("Error in passport OAuth handler:", err.message);
    return done(err, false);
  }
}

/* ================= PASSPORT SETUP ================= */
export default function setupPassport() {

  /* GOOGLE */
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      (accessToken, refreshToken, profile, done) =>
        handleOAuth(profile, "google", done)
    )
  );

  /* MICROSOFT */
  passport.use(
    new MicrosoftStrategy(
      {
        clientID: process.env.MICROSOFT_CLIENT_ID,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
        callbackURL: process.env.MICROSOFT_CALLBACK_URL,
        scope: ["user.read", "email", "openid", "profile"],
      },
      (accessToken, refreshToken, profile, done) =>
        handleOAuth(profile, "microsoft", done)
    )
  );

  /* PASSPORT SESSION */
  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
}