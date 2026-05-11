import mongoose from "mongoose";

const emailVerifyDummySchema = new mongoose.Schema({
  email:{
    type:String,
    required:true,
    unique:true,
    lowercase:true,
  },
  otp:{
    type:String,
    required:true,
  },
  otpExpiry:{
    type:Date,
    required:true,
  }
}, { timestamps: true });
export default mongoose.model("EmailVerifyDummy", emailVerifyDummySchema);