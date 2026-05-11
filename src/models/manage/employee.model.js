// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, unique: true,},
    firstName: { type: String, required: true, trim: true, },
    lastName: { type: String, required: true, trim: true, },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true,},
    password: { type: String, required: true, minlength: 6, },
    resetPasswordToken: { type: String,default: null},
    resetPasswordExpiresAt: { type: Date, default: null },
    role: {
      type: Number, enum: [0, 1, 2, 3, 4], // 0->superadmin, 1->admin, 2->manager, 3->exective,  
      default: 3,},
    personalEmail: {type: String, required: true, lowercase: true, trim: true, },
    permissions: { type: [String], default: [] },
    createdBy: { type: String, lowercase: true, trim: true, },
    isNewEmployee: { type: Boolean, default: true, },
    emailVerified: { type: Boolean, default: false, },
    emailVerificationToken: { 
      token: { type: String, },
    expiresAt: {type: Date, },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },},
  {
    timestamps: true,
    collection: "employees",
  }
);
employeeSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});
// Instance method to compare password
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Employee = mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
export default Employee;
