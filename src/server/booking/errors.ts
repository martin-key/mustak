export type BookingErrorCode =
  | "SERVICE_NOT_FOUND"
  | "BARBER_NOT_FOUND"
  | "DATE_OUT_OF_RANGE"
  | "SLOT_UNAVAILABLE"
  | "TOO_MANY_BOOKINGS"
  | "NOT_FOUND"
  | "ALREADY_CANCELLED"
  | "NOT_CANCELLABLE"
  | "TOO_LATE_TO_CANCEL";

const messages: Record<BookingErrorCode, string> = {
  SERVICE_NOT_FOUND: "Услугата не съществува или вече не се предлага.",
  BARBER_NOT_FOUND: "Бръснарят не съществува или вече не приема.",
  DATE_OUT_OF_RANGE: "За тази дата не може да се записва.",
  SLOT_UNAVAILABLE: "Този час току-що беше зает. Изберете друг.",
  TOO_MANY_BOOKINGS: "Имате достатъчно записани часове. Откажете някой от тях или се обадете в салона.",
  NOT_FOUND: "Часът не е намерен.",
  ALREADY_CANCELLED: "Часът вече е отказан.",
  NOT_CANCELLABLE: "Този час не може да бъде отказан.",
  TOO_LATE_TO_CANCEL: "Твърде късно е за отказ онлайн. Моля, обадете се в салона.",
};

/** Очаквана грешка в бизнес логиката. Съобщението е на български и може да се покаже на потребителя. */
export class BookingError extends Error {
  readonly code: BookingErrorCode;

  constructor(code: BookingErrorCode, message?: string) {
    super(message ?? messages[code]);
    this.name = "BookingError";
    this.code = code;
  }
}

export function isBookingError(error: unknown): error is BookingError {
  return error instanceof BookingError;
}
