import { useState, useEffect } from "react";
import { CompTimeGrant } from "@/types/compTime";
import { compTimeApi } from "@/services/compTimeApi";

export const useCompTimeExpiringSoon = (days = 30) => {
  const [expiringSoon, setExpiringSoon] = useState<CompTimeGrant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await compTimeApi.getExpiringSoon(days);
        setExpiringSoon(data);
      } catch (error) {
        console.error("Failed to load expiring comp time grants:", error);
        setExpiringSoon([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  return { expiringSoon, loading };
};
