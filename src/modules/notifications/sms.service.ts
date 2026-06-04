import axios from "axios";

const SMS_API_URL = "https://smsplus.sslwireless.com/api/v3/send-sms";

// put these in .env
const API_TOKEN = process.env.SSL_SMS_API_TOKEN;
const SID = process.env.SSL_SMS_SID;

export async function sendSms({
  mobile,
  message,
}: {
  mobile: string;
  message: string;
}) {
  try {
    const payload = {
      api_token: API_TOKEN,
      sid: SID,
      msisdn: mobile, // receiver number
      sms: message,
      csms_id: `csms_${Date.now()}`, // unique id
    };

    const response = await axios.post(SMS_API_URL, payload);

    const resData = response.data;

    if (resData?.status === "SUCCESS") {
      return {
        success: true,
        messageId: payload.csms_id,
        raw: resData,
      };
    }

    throw new Error(resData?.error_message || "SMS failed");
  } catch (error: any) {
    throw new Error(error?.message || "SMS sending error");
  }
}

export const formatMobile = (number: string) => {
  let n = number.replace(/\D/g, "");

  if (n.startsWith("01")) {
    n = "880" + n.substring(1);
  }

  return n;
};
