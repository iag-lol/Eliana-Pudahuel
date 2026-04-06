import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import type { StockRequest } from "../types";
import { applyStockRequestRealtimeDelta } from "../lib/queryHelpers";

export const useStockRequestsRealtime = ({
  enabled,
  queryClient,
  mapRow,
  limit
}: {
  enabled: boolean;
  queryClient: QueryClient;
  mapRow: (row: Record<string, unknown>) => StockRequest;
  limit: number;
}) => {
  const [realtimeHealthy, setRealtimeHealthy] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel("pudahuel-stock-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pudahuel_stock_requests" },
        (payload) => {
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          queryClient.setQueryData<StockRequest[]>(["stock-requests"], (previous = []) =>
            applyStockRequestRealtimeDelta({
              previous,
              eventType,
              newRow: payload.new as Record<string, unknown>,
              oldRow: payload.old as Record<string, unknown>,
              mapRow,
              limit
            })
          );
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeHealthy(false);
          return;
        }
        if (status === "SUBSCRIBED") {
          setRealtimeHealthy(true);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient, mapRow, limit]);

  return realtimeHealthy;
};
