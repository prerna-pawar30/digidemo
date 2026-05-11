import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name:{
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    permissionId:{
      type: String,
      required: true,
      unique: true,
    },
    createdBy:{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Permission", permissionSchema);

