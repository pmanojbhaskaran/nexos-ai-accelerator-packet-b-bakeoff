import { HttpException, HttpStatus } from "@nestjs/common";
import type { ErrCode } from "./codes";

export type ApiError = {
  code: ErrCode;
  message: string;
  field?: string;
  rowIndex?: number;
};

export function badRequest(errors: ApiError[]): never {
  throw new HttpException({ ok: false, errors }, HttpStatus.BAD_REQUEST);
}

export function unprocessable(errors: ApiError[]): never {
  throw new HttpException({ ok: false, errors }, HttpStatus.UNPROCESSABLE_ENTITY);
}

export function notFound(errors: ApiError[]): never {
  throw new HttpException({ ok: false, errors }, HttpStatus.NOT_FOUND);
}

export function forbidden(errors: ApiError[]): never {
  throw new HttpException({ ok: false, errors }, HttpStatus.FORBIDDEN);
}
