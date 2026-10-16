import { useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { storage } from "./storage";

export function useTeacherToken(): {
  classId: number | null;
  token: string | null;
  error: string | null;
} {
  const { classId: paramClassId } = useParams<{ classId: string }>();
  const location = useLocation();
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classId = paramClassId ? parseInt(paramClassId, 10) : null;

  useEffect(() => {
    if (!classId || isNaN(classId)) {
      setError("Invalid class ID in URL.");
      return;
    }

    const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    let foundToken = hash;

    if (foundToken) {
      storage.setTeacherToken(classId, foundToken);
    } else {
      foundToken = storage.teacherToken(classId) ?? "";
    }

    if (!foundToken) {
      setError(
        "Open this class with your secret teacher link. The link contains the authorization key required to view and manage this class."
      );
      setToken(null);
    } else {
      setToken(foundToken);
      setError(null);
    }
  }, [classId, location.hash]);

  return { classId, token, error };
}
