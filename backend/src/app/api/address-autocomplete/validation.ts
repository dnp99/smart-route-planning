import { HttpError } from "../../../lib/http";
import { MAX_QUERY_LENGTH } from "./constants";

export const parseAndValidateQuery = (request: Request) => {
  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("query") ?? "";
  const query = rawQuery.trim();

  if (query.length > MAX_QUERY_LENGTH) {
    throw new HttpError(400, `Query must be at most ${MAX_QUERY_LENGTH} characters.`);
  }

  return query;
};
