import { createCrudService } from "../../services/crud.service";
import Prescription from "./prescription.model";

/**
 * Replace this with your real SMS service.
 * Example:
 *   import { sendSms } from "../../services/sms.service";
 */
async function sendSms(params: { mobile: string; message: string }) {
  // throw new Error("SMS service not connected yet");
  console.log("Sending SMS to:", params.mobile);
  console.log("Message:", params.message);

  return {
    success: true,
    messageId: `sms_${Date.now()}`,
  };
}

const base = createCrudService(Prescription, {
  defaultSort: "-createdAt",
  searchFields: [
    "farmerName",
    "farmerMobile",
    "cropName",
    "pestTypeName",
    "solutionName",
    "doseName",
  ],
  allowedFilterFields: [
    "createdBy",
    "smsStatus",
    "title",
    "farmerMobile",
    "cropName",
    "pestTypeName",
    "solutionName",
    "doseName",
  ],
  defaultPopulate: [{ path: "createdBy", select: "name mobileNo role" }],
});

type PrescriptionInput = {
  title: "MR" | "MS";
  farmerName: string;
  farmerMobile: string;
  cropName: string;
  pestTypeName: string;
  solutionName: string;
  doseName: string;
};

function cleanText(value: any) {
  return String(value ?? "").trim();
}

function validatePrescriptionInput(payload: PrescriptionInput) {
  const title = cleanText(payload.title);
  const farmerName = cleanText(payload.farmerName);
  const farmerMobile = cleanText(payload.farmerMobile);
  const cropName = cleanText(payload.cropName);
  const pestTypeName = cleanText(payload.pestTypeName);
  const solutionName = cleanText(payload.solutionName);
  const doseName = cleanText(payload.doseName);

  if (!["MR", "MS"].includes(title)) {
    throw new Error("Invalid title");
  }
  if (!farmerName) throw new Error("Farmer name is required");
  if (!farmerMobile) throw new Error("Farmer mobile number is required");
  if (!cropName) throw new Error("Crop name is required");
  if (!pestTypeName) throw new Error("Pest type is required");
  if (!solutionName) throw new Error("Solution is required");
  if (!doseName) throw new Error("Dose is required");

  return {
    title: title as "MR" | "MS",
    farmerName,
    farmerMobile,
    cropName,
    pestTypeName,
    solutionName,
    doseName,
  };
}

function buildPreviewMessage(payload: PrescriptionInput) {
  const data = validatePrescriptionInput(payload);

  const honorific = data.title === "MR" ? "ভাই" : "বোন";

  return `প্রিয় ${data.farmerName} ${honorific},
আপনার ${data.cropName} এর জমিতে ${data.pestTypeName} সমস্যার জন্য আনতাব আগ্রো এর সবচেয়ে কার্যকরী ${data.solutionName} ${data.doseName}।
পণ্যটি ব্যবহার করুন, নিজেই ফলাফল দেখুন।`;
}

export const prescriptionService = {
  ...base,

  buildPreviewMessage,

  async createPrescription(payload: PrescriptionInput, createdBy: string) {
    const data = validatePrescriptionInput(payload);
    const previewMessageBn = buildPreviewMessage(data);

    const created = await base.create({
      ...data,
      previewMessageBn,
      smsStatus: "pending",
      createdBy,
    });

    try {
      const smsResult = await sendSms({
        mobile: data.farmerMobile,
        message: previewMessageBn,
      });

      await base.update(String(created._id), {
        smsStatus: "sent",
      });

      return {
        ...created,
        smsStatus: "sent",
        smsProviderMessageId: smsResult?.messageId || "",
      };
    } catch (error: any) {
      await base.update(String(created._id), {
        smsStatus: "failed",
      });

      return {
        ...created,
        smsStatus: "failed",
        smsError: error?.message || "SMS sending failed",
      };
    }
  },

  async getMyPrescriptions(userId: string, filters: any = {}) {
    return base.list({
      filter: {
        createdBy: userId,
        ...(filters.smsStatus ? { smsStatus: filters.smsStatus } : {}),
        ...(filters.title ? { title: filters.title } : {}),
      },
      page: filters.page ?? 1,
      limit: filters.limit ?? 15,
      q: filters.q,
      sort: "-createdAt",
    });
  },

  async getAllPrescriptions(filters: any = {}) {
    return base.list({
      filter: {
        ...(filters.createdBy ? { createdBy: filters.createdBy } : {}),
        ...(filters.smsStatus ? { smsStatus: filters.smsStatus } : {}),
        ...(filters.title ? { title: filters.title } : {}),
      },
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
      q: filters.q,
      sort: "-createdAt",
    });
  },
};

export type PrescriptionService = typeof prescriptionService;
