// import passport from 'passport';
// import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { Strategy as MicrosoftStrategy } from 'passport-microsoft';
// import User from '../models/userModel.js';
// import { v6 as uuidv6 } from 'uuid';
// export default function setupPassport(){
// // GOOGLE
// passport.use(new GoogleStrategy(
//   {
//     clientID: process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: process.env.GOOGLE_CALLBACK_URL,
//   },
//   async (accessToken, refreshToken, profile, done) => {
//     try {
//       const email = profile.emails?.[0]?.value?.toLowerCase();
//       if (!email) return done(null, false, { message: "No email from Google" });
//       let user = await User.findOne({ email });
//       const fullName = profile.displayName ? profile.displayName.split(" ") : [];
//       const firstName = fullName[0] || "Unknow";
//        const lastName = fullName[1] || "";
//       if (!user) {
//         user = await User.create({
//           userId:uuidv6(),
//           firstName,
//           lastName,
//           email: email,
//           provider: "google",
//           googleId: profile.id,
//           emailVerified: true,
//           // Required fields for your schema
//           password: "GOOGLE_AUTH_USER",
//         });
//       } else if (user.provider !== "google") {
//         user.provider = "google";
//         user.googleId = profile.id;
//         emailVerified: true,
//         if(!user.avter)
//         await user.save();
//       }
//       return done(null, user);
//     } catch (err) {
//       return done(err, false);
//     }
//   }
// ));

// // MICROSOFT
// passport.use(new MicrosoftStrategy({
// clientID: process.env.MICROSOFT_CLIENT_ID,
// clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
// callbackURL: process.env.MICROSOFT_CALLBACK_URL,
// scope: ['user.read', 'email', 'openid', 'profile'],
// }, async(accessToken, refreshToken, profile, done) => {
// try {
//   const email = profile.emails?.[0]?.value?.toLowerCase();
//   if (!email) return done(null, false, { message: "No email from Microsoft" });
 
//   let user = await User.findOne({ email });

//   // Extract first and last name from Microsoft display name
//   const fullName = profile.displayName ? profile.displayName.split(" ") : [];
//   const firstName = fullName[0] || "Unknown";
//   const lastName = fullName[1] || "";
//   const avatar = profile.photos?.[0]?.value;
//   if (!user) {
//     user = await User.create({
//       userId:uuidv6(),
//       firstName,
//       lastName,
//       email,
//       avatar,
//       provider: "microsoft",
//       providerId: profile.id,
//       emailVerified: true,
//       // Required fields for your schema
//       password: "MICROSOFT_AUTH_USER",
// });
// } else {
// if (user.provider !== 'microsoft') {
// user.provider = 'microsoft';
// user.providerId = profile.id;
// emailVerified: true,
// if(!user.avatar){
//   avatar
// }
// await user.save();
// }
// }
// return done(null, user);
// } catch (err) {
// return done(err, false);
// }
// }));

// // We are not using sessions; passport requires these but they will be no-ops
// passport.serializeUser((user, done) => done(null, user.id));
// passport.deserializeUser(async (id, done) => {
// try {
// const user = await User.findById(id);
// done(null, user);
// } catch (err) {
// done(err);
// }
// });
// }


import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as MicrosoftStrategy } from "passport-microsoft";
import User from "../models/ecommarace/user.model.js";
import { v6 as uuidv6 } from "uuid";

/* ================= COMMON OAUTH HANDLER ================= */

async function handleOAuth(profile, provider, done) {
  try {

    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(null, false, { message: `No email from ${provider}` });
    }

    let user = await User.findOne({ email });

    const firstName = profile.name?.givenName || "Unknown";
    const lastName = profile.name?.familyName || "";
    const avatar = profile.photos?.[0]?.value;

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