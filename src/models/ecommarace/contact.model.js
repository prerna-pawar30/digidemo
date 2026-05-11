import mongoose from "mongoose";
const contactSchema  = new mongoose.Schema({
  contactId: {
    type: String,
    unique: true,    
    index: true      
  },
  firstName:{
    type:String,
    required:true,
    trim:true
  },
  lastName:{
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
}, { timestamps: true });

export default mongoose.model("Contact", contactSchema);