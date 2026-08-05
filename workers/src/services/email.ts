import { getSettings } from "../env";
import { badGateway } from "../http";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/**
 * Replaces the SMTP client with Brevo's transactional HTTP API — Workers cannot open raw
 * TCP to an SMTP server.
 *
 * With no API key configured the message is logged instead of sent, which keeps local
 * development runnable, and is why `emailConfigured` gates the dev passcode echo in the
 * auth service. Delivery failure propagates to the caller as a 502 rather than being
 * swallowed, so a broken mail configuration surfaces immediately instead of looking like
 * a lost email.
 */
export async function sendEmail(
  env: Env,
  toEmail: string,
  subject: string,
  body: string
): Promise<void> {
  const settings = getSettings(env);

  if (!settings.emailConfigured) {
    console.warn(
      JSON.stringify({
        message: "BREVO_API_KEY not configured — logging email instead of sending",
        to: toEmail,
        subject,
        body,
      })
    );
    return;
  }

  let response: Response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: settings.brevoFromName, email: settings.brevoFromEmail },
        to: [{ email: toEmail }],
        subject,
        textContent: body,
      }),
    });
  } catch (error) {
    console.error(
      JSON.stringify({ message: "Brevo request failed", to: toEmail, error: String(error) })
    );
    throw badGateway("Could not send the passcode email. Check the mail server configuration.");
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      JSON.stringify({
        message: "Brevo rejected the message",
        to: toEmail,
        status: response.status,
        detail: detail.slice(0, 500),
      })
    );
    throw badGateway("Could not send the passcode email. Check the mail server configuration.");
  }
}

export async function sendOtpEmail(
  env: Env,
  toEmail: string,
  code: string,
  ttlMinutes: number
): Promise<void> {
  const settings = getSettings(env);
  const body =
    `Your sign-in passcode for the ${settings.appName} is:\n\n` +
    `    ${code}\n\n` +
    `It expires in ${ttlMinutes} minutes and can only be used once.\n\n` +
    "If you did not request this, you can ignore this email — no one can sign in without the passcode.";
  await sendEmail(env, toEmail, `${code} is your sign-in passcode`, body);
}
