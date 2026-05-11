import Joi from "joi";

export const submitJobApplicationValidator = Joi.object({
  jobId: Joi.string().trim().required(),
  firstName: Joi.string().trim().required(),
  lastName: Joi.string().trim().required(),
  email: Joi.string().email().trim().required(),
  phone: Joi.string().trim().required(),
  city: Joi.string().trim().allow("", null).optional(),
  state: Joi.string().trim().allow("", null).optional(),
  country: Joi.string().trim().allow("", null).optional(),
  totalExperienceYears: Joi.number().min(0).optional(),
  currentCompany: Joi.string().trim().allow("", null).optional(),
  currentCTC: Joi.number().min(0).optional(),
  expectedCTC: Joi.number().min(0).optional(),
  noticePeriodDays: Joi.number().min(0).optional(),
  portfolioUrl: Joi.string().uri().allow("", null).optional(),
  linkedinUrl: Joi.string().uri().allow("", null).optional(),
  githubUrl: Joi.string().uri().allow("", null).optional(),
  coverLetter: Joi.string().trim().allow("", null).optional(),
  source: Joi.string()
    .valid("career_page", "linkedin", "naukri", "referral", "manual", "other")
    .optional(),
});

export const updateApplicationStatusValidator = Joi.object({
  status: Joi.string()
    .valid(
      "applied",
      "shortlisted",
      "interview_scheduled",
      "interviewed",
      "selected",
      "rejected",
      "hired"
    )
    .required(),
    permission: Joi.string().trim().required(),
  note: Joi.string().trim().allow("", null).optional(),
});

export const addApplicationNoteValidator = Joi.object({
  note: Joi.string().trim().required(),
});