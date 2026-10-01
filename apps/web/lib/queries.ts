"use client";

import { useQuery } from "@tanstack/react-query";
import type { InsurerMetrics, Product, Scenario } from "@stacked/claim-engine";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

const reference = { staleTime: Infinity, gcTime: Infinity } as const;

export const useInsurers = () =>
  useQuery({ queryKey: ["insurers"], queryFn: () => getJSON<InsurerMetrics[]>("/api/insurers"), ...reference });
export const useProducts = () =>
  useQuery({ queryKey: ["products"], queryFn: () => getJSON<Product[]>("/api/products"), ...reference });
export const useScenarios = () =>
  useQuery({ queryKey: ["scenarios"], queryFn: () => getJSON<Scenario[]>("/api/scenarios"), ...reference });
