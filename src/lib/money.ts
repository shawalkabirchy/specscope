import { AppError } from "./errors";

export const MAX_AMOUNT_MINOR = 1_000_000_000;

export function parseMoney(value: string): number {
  const text = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter an amount with up to two decimal places.",
      {
        hourlyRateMinor: "Use a positive amount with up to two decimal places.",
      },
    );
  }
  const [whole, fraction = ""] = text.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR) {
    throw new AppError(
      "VALIDATION_ERROR",
      "The maximum entered amount is 10,000,000.00.",
      { hourlyRateMinor: "The maximum rate is 10,000,000.00." },
    );
  }
  return minor;
}

export function moneyInput(minor: number): string {
  return Math.floor(minor / 100) + "." + String(minor % 100).padStart(2, "0");
}

export function formatMoney(minor: number, currency: "USD" | "BDT"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: currency === "BDT" ? "code" : "symbol",
  }).format(minor / 100);
}

export function estimateFee(
  classification: "within" | "clarify" | "additional",
  estimatedMinutes: number | undefined,
  hourlyRateMinor: number,
) {
  if (classification !== "additional")
    return { billableMinutes: 0, feeMinor: 0 };
  if (
    !Number.isSafeInteger(estimatedMinutes) ||
    estimatedMinutes! < 1 ||
    estimatedMinutes! > 10_000
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter an estimate from 1 to 10,000 minutes.",
      { estimatedMinutes: "Enter a whole number from 1 to 10,000." },
    );
  }
  if (
    !Number.isSafeInteger(hourlyRateMinor) ||
    hourlyRateMinor < 1 ||
    hourlyRateMinor > MAX_AMOUNT_MINOR
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Enter a valid positive hourly rate.",
    );
  }
  const billableMinutes = Math.ceil(estimatedMinutes! / 15) * 15;
  const feeMinor = Math.floor((billableMinutes * hourlyRateMinor + 30) / 60);
  if (!Number.isSafeInteger(feeMinor))
    throw new AppError("VALIDATION_ERROR", "The calculated fee is too large.");
  return { billableMinutes, feeMinor };
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours
    ? hours + "h" + (remainder ? " " + remainder + "m" : "")
    : remainder + "m";
}
