import { C8yPactRecord } from "./c8ypact";
import _ from "lodash";

export function isURL(obj: any): obj is URL {
  return obj instanceof URL;
}

export function relativeURL(url: URL | string): string | undefined {
  try {
    const u = isURL(url) ? url : new URL(url);
    return u.pathname + u.search;
  } catch {
    return undefined;
  }
}

export function removeBaseUrlFromString(url: string, baseUrl?: string): string {
  if (!url || !baseUrl) {
    return url;
  }
  let normalizedBaseUrl = _.clone(baseUrl);
  while (normalizedBaseUrl.endsWith("/")) {
    normalizedBaseUrl = normalizedBaseUrl.slice(0, -1);
  }
  let result = url.replace(normalizedBaseUrl, "");
  if (_.isEmpty(result)) {
    result = "/";
  }
  return result;
}

export function removeBaseUrlFromRequestUrl(
  record: C8yPactRecord,
  baseUrl?: string
): void {
  if (!record?.request?.url || !baseUrl || !_.isString(baseUrl)) {
    return;
  }
  record.request.url = removeBaseUrlFromString(record.request.url, baseUrl);
}

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function tenantUrl(
  baseUrl?: string,
  tenant?: string
): string | undefined {
  if (!baseUrl || !tenant) return undefined;

  try {
    const url = new URL(baseUrl);
    const hostComponents = url.host.split(".");
    if (hostComponents.length <= 2) {
      url.host = `${tenant}.${hostComponents.join(".")}`;
    } else {
      const instance = url.host.split(".")?.slice(1)?.join(".");
      url.host = `${tenant}.${instance}`;
    }
    return normalizeUrl(url.toString());
  } catch {
    // no-op
  }
  return undefined;
}

export function updateURLs(
  value: string,
  from: { baseUrl: string; tenant?: string },
  to: { baseUrl: string; tenant?: string }
): string {
  if (!value || !from || !to) return value;
  let result = value;

  const fromTenantUrl = tenantUrl(from.baseUrl, from.tenant);
  const toTenantUrl = tenantUrl(to.baseUrl, to.tenant);
  if (fromTenantUrl && toTenantUrl) {
    result = result.replace(new RegExp(fromTenantUrl, "g"), toTenantUrl);
  }
  if (from.baseUrl && to.baseUrl) {
    const fromBaseUrl = normalizeUrl(from.baseUrl);
    const toBaseUrl = normalizeUrl(to.baseUrl);
    if (fromBaseUrl && toBaseUrl) {
      result = result.replace(new RegExp(fromBaseUrl, "g"), toBaseUrl);
    }

    result = result.replace(
      new RegExp(from.baseUrl.replace(/https?:\/\//i, ""), "g"),
      to.baseUrl.replace(/https?:\/\//i, "")
    );

    if (fromTenantUrl) {
      result = result.replace(
        new RegExp(fromTenantUrl, "g"),
        toTenantUrl || toBaseUrl
      );
    }
  }
  return result;
}
