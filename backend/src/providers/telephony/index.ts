import { env } from "../../config/env.js";
import { TelephonyProvider } from "./TelephonyProvider.js";
import { MockTelephonyProvider } from "./MockTelephonyProvider.js";
import { TwilioTelephonyProvider } from "./TwilioTelephonyProvider.js";

let provider: TelephonyProvider;

/**
 * Selects the active TelephonyProvider from `TELEPHONY_PROVIDER`. Defaults to
 * (and falls back to) the mock provider, so the app always works without any
 * telephony credentials. Setting `TELEPHONY_PROVIDER=twilio` without
 * `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN` configured will throw at startup
 * (see TwilioTelephonyProvider) rather than silently pretending to work.
 */
export function getTelephonyProvider(): TelephonyProvider {
  if (!provider) {
    switch (env.telephony.provider) {
      case "twilio":
        provider = new TwilioTelephonyProvider();
        break;
      case "mock":
      default:
        provider = new MockTelephonyProvider();
    }
  }
  return provider;
}
